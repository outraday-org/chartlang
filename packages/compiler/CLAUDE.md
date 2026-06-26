# packages/compiler/

`@invinite-org/chartlang-compiler` — TS-AST transformer + esbuild-driven bundler.

## Invariants

- **`compile`/`bundleModule` resolve `@invinite-org/chartlang-core` from
  disk by default; `inMemoryModules` overrides that.** The esbuild
  `bundle: true` step pins `resolveDir` to the compiler package dir and
  walks `node_modules` to inline core — fine on a normal Node install,
  but it throws "Could not resolve @invinite-org/chartlang-core" when the
  compiler runs somewhere the workspace package is not installed as a
  resolvable module (e.g. a bundled serverless function). Passing
  `inMemoryModules` (`{ [specifier]: selfContainedEsmSource }`) installs an
  esbuild plugin whose resolve/load hooks serve those specifiers from
  memory before the filesystem walk. Values MUST be pre-bundled (no
  remaining bare imports). Default behavior (no map / empty map) is
  byte-identical — keep it that way so the determinism + golden tests hold.
- **Callsite-id format is load-bearing.** Slot ids follow
  `<sourcePath>:<line>:<col>#<callIndex>` (§5.5). Lines and columns are
  1-based, read from the **input** source file before any rewrite. The
  runtime keys per-script state on this exact string — change the format
  and every cached state goes stale. Hand-written code always uses
  `callIndex = 0`; non-zero is reserved for future macros. The minting is
  centralised in the exported `callsiteIdFor(sourceFile, call, sourcePath)`
  helper in `callsiteIdInjection.ts`; both the injector AND the
  `request.security` expression analyser (`extractRequestAnalysis`) call it so
  the injected leading-argument literal and the
  `manifest.securityExpressions[*].slotId` are byte-identical. Never re-derive
  the format inline.
- **`request.security` has two arities; the expression form is analysed, not
  rewritten.** `extractRequestAnalysis` (in `extractRequestedIntervals.ts`)
  detects a second arrow/function-expression argument and records one
  `SecurityExpressionDescriptor { slotId, symbol?, interval, paramName }` per
  callsite in `manifest.securityExpressions` (sorted by `slotId`, omitted when
  empty so data-only snapshots stay byte-identical). The compiled callback stays
  **inline** in the emitted module — the descriptor is only the registry the
  runtime uses to know which slot id runs on an HTF clock. Only a
  string-literal `interval` anchors an expression unit; an `input.enum`
  interval (multi-valued) does not. The descriptor's `symbol` is attached only
  for a string-literal or `input.symbol`-default symbol (a single concrete
  clock); an `input.enum`/dynamic/empty-literal/omitted symbol leaves it off
  (omitted ⇒ chart symbol), exactly as a multi-valued `input.enum` interval
  can't anchor a single clock.
- **`request.security` reads the optional `symbol` opt the same three ways as
  `interval`, plus the `input.symbol`-default path, and emits
  `manifest.requestedFeeds`.** `resolveOptString` reads `{ symbol }` as a string
  literal, an `inputs.<enum>` access (all options), an `inputs.<name>`
  `input.symbol` **default** literal (NEW — `interval` never uses this; an
  `input.interval` is the main-chart interval, not a feed interval), an absent
  property, or a genuinely-dynamic expression. A dynamic symbol emits the
  append-only `request-security-symbol-not-literal` diagnostic and is excluded
  (mirrors `request-security-interval-not-literal`; both can fire on one
  callsite). The analyser builds `RequestAnalysis.feeds` as the cartesian
  product of resolved symbols × intervals, deduped into a
  `Map<string, RequestedFeed>` keyed by the shared core `feedKey(symbol,
  interval)` and emitted sorted by that key (byte-stable for the determinism
  gate). `requestedFeeds` is omitted when empty (no-`request.security` snapshots
  stay byte-identical) and — like `securityExpressions` — attaches to the
  **default manifest only**. A symbol-omitted (or empty-literal, per `feedKey`'s
  empty-collapse) feed keeps its interval in `requestedIntervals` (the
  unchanged main-symbol projection); a present-symbol feed does not.
  `request.lowerTf` has no symbol dimension — it never produces a feed and keeps
  its existing interval-only path. The capture check `validateSecurityExpr`
  runs **once at file scope** (the `validateExpressions: true` flag is passed
  only by `transformAndAnalyse`'s file-level call, never the per-drawn
  `buildDrawnManifest` call) so multi-export files don't double-report. Its
  subset: the `bar` param + body locals, ambient `ta` / `inputs` (resolved via
  the now-exported `resolveCoreSymbolName`), `Math.*` (individual hostile
  members like `Math.random` stay the hostile-global pass's job), the pure
  value globals `NaN` / `undefined` / `Infinity` (`SAFE_VALUE_GLOBALS`), and
  literals; anything else — a nested function/arrow, a `this` reference, or an
  outer binding reached via a shorthand opts property (`{ outerLen }`) or a
  parameter default (`(bar = outer) => …`) — is
  `request-security-expr-captures-local`. Parameter initialisers are walked
  alongside the body precisely to catch that last form. The
  `securityExpressions` list attaches to the **default manifest only** (mirrors
  `plots` scoping).
- **Static-analysis runs on the original AST.** `structuralChecks`,
  `forbiddenConstructs`, and `statefulCallInLoop` operate on the source
  file as parsed; the transformer is a pure rewrite step that never
  mutates input nodes. Extractors (capabilities / max-lookback / inputs)
  also run on the original AST — the rewrite is only for the bundler in
  Task 3.
- **`extractMaxLookback` ignores the universal `opts.offset`.** `offset`
  is a presentation-only display x-shift (Option A): it rides the plot
  emission as `PlotEmission.xShift` and the adapter renders it; the
  numeric series value is unshifted, so the runtime never reads a deeper
  buffer slot. `offset` (any sign, literal or not) contributes `0` to
  `maxLookback`. This is distinct from the `bar.point(-N, …)` rule below,
  which is a real historical buffer read.
- **`extractMaxLookback` counts a negative-literal `bar.point(-N, …)` as
  lookback depth.** `bar.point(offset, price)` resolves an integer bar
  offset to a `WorldPoint` at runtime against the time ring buffer; a
  negative integer-literal offset reads `time.at(N)`, so the buffer must
  retain `N` slots — `isBarPointCall` + `readBarPointLookback` raise
  `maxLookback` by `abs(N)`, exactly like a `series[N]` lookback. The
  call is matched TEXTUALLY (`bar.point` property-access shape, mirroring
  the OHLCV `isSeriesShapedAccess` recognition) so it fires for both the
  destructured `compute({ bar })` binding and a `declare const bar: Bar`
  test fixture. `bar.point(0, …)` (current), positive (future,
  extrapolated) offsets, and non-literal / dynamic offsets contribute
  `0`; the ambient `program.ts` shim declares `Bar.point` in lockstep
  with core. Drawing anchors stay ONLY `WorldPoint { time, price }`.
- **`extractMaxLookback` counts a literal-length `ta.highestbars` /
  `ta.lowestbars` as `length − 1` lookback depth.** Both primitives return
  the bar OFFSET (≤ 0) to the trailing-window extreme, so the deepest offset
  they can return is `−(length − 1)`. A downstream `bar.point(<that offset>,
  …)` anchor reads `time.at(length − 1)`, so the time ring buffer must retain
  `length − 1` slots. `readHighestLowestBarsDepth` reads the LITERAL second
  positional `length` arg in the `ta.`-prefixed branch of `visit` and raises
  `maxLookback` to `length − 1` (it returns `0` for `length <= 1`). A
  non-literal length contributes `0` (cannot be sized at compile time). This
  is independent of the `opts.offset` and `bar.point(-N, …)` rules and stacks
  via the shared `maxLookback` max.
- **`extractMaxLookback` resolves bounded-loop & const series indices to a
  precise `maxLookback`.** Every series index runs through
  `resolveIndexUpperBound` (`analysis/resolveIndexBound.ts`): a numeric
  literal, a bare bounded-loop induction variable (`series[i]` inside
  `for (let i = 0; i < N; i++)` → `N − 1`; `<=` → `N`), and a lexically
  visible `const` numeric-literal binding (`series[k]`) each size the ring
  buffer exactly, with **no** `dynamic-series-index` warning and **no**
  `dynamicFallback`. The resolver **over-approximates and never under-sizes**:
  it returns `null` (keeping today's warn + `dynamicFallback = 5000`) for a
  non-terminating `>`/`>=` loop, a loop variable reassigned in the body
  beyond its `++`, a shadowed loop name that does not resolve to the loop's
  own declaration (checker symbol-identity guarded), a `let`/mutable
  binding, a `const` not initialised from a numeric literal, an unknown
  identifier, or any non-affine expression (see below). A resolved
  negative bound contributes `0`. **Affine combinations** (`+`, `−`, `*`,
  unary `±`, and parentheses) of literals / `const` numbers /
  bounded-loop ranges are sized via integer interval arithmetic on the
  interval's **upper endpoint**: `resolveIndexUpperBound` is
  `evalInterval(argument, …).hi`, where `evalInterval` represents each
  loop variable as its full `[start, max]` range (so `K − i` is largest
  when `i` is smallest) and multiplication is sign-correct (min/max of the
  four endpoint products). Division, modulo, exponent, bitwise operators,
  other prefix unaries (`~`, `!`), calls, property accesses, and unknown
  identifiers — or any sub-term the evaluator cannot bound — collapse the
  whole interval to `null` and fall back to the `dynamic-series-index` +
  `dynamicFallback = 5000` path; a non-finite endpoint (overflow /
  pathological literal) is rejected the same way. The numeric `const`
  environment is rebuilt at **each index use site** (`collectConstNumberEnv`)
  so it obeys declaration order, sibling-block isolation, and shadowing;
  a single scope-wide map would be unsound. `parseBoundedForLoop`
  (`analysis/loopBounds.ts`) is the **single source of truth** for "what is
  a bounded loop" — both `forbiddenConstructs` (reject every other shape)
  and `resolveIndexUpperBound` (size the index range) call it so the two
  passes can never disagree. `unwrapParens` also lives in `loopBounds.ts`
  (a leaf module) so `extractMaxLookback` and `resolveIndexBound` share it
  without a circular import.
- **`extractMaxLookback` recognises `state.series`-bound variables as
  series-shaped.** `collectSeriesVarNames` adds a variable's name to
  `seriesVarNames` when its initializer is a `ta.*` call **or** a
  `state.series(...)` call (matched on `resolveCalleeName(...) ===
  "state.series"`, the same resolution the slot-injection pass uses — so an
  element-access form like `state["series"](...)` is not recognised; that
  form is rejected upstream as `stateful-call-element-access`). Once the name
  is collected, `isSeriesShapedAccess`'s identifier branch and the shared
  `resolveIndexUpperBound` path size an `s[N]` index **identically** to a
  `ta.*`-bound variable: a resolvable index (literal / bounded-loop
  induction var / `const` numeric binding) folds into `maxLookback` with no
  diagnostic; a genuinely-dynamic index trips `dynamic-series-index` +
  `dynamicFallback = 5000`. This is analysis-only — no index-resolution logic
  is re-implemented, and aliases (`const t = s; t[2]`) are not tracked (same
  limitation as the `ta.*` arm). The slot-id injection for `state.series`
  needs no change (Task 1 registered it `{ slot: true }`).
- **`state.array` / `state.map` capacity must resolve to a bounded
  positive-integer literal.** `runStateArrayCapacity`
  (`analysis/stateArrayCapacity.ts`) walks the **original** AST and, for each
  bounded-collection callsite whose `resolveCalleeName(...)` is in
  `CAPACITY_GUARDED_NAMES` (`state.array`, `state.map` — append future bounded
  collections here rather than forking a parallel pass; the element-access form
  is not double-reported, it is already `stateful-call-element-access`), reads
  the capacity as `node.arguments[0]`. Both primitives share the
  `state-array-capacity-not-literal` / `state-array-capacity-exceeds-max` codes
  and `MAX_STATE_ARRAY_CAPACITY` ceiling; the message interpolates the matched
  primitive name (byte-identical to the old text for `state.array`). This is the pre-injection position: the pass
  runs before `callsiteIdInjection` prepends the slot-id literal, so the
  capacity is `arguments[0]` here even though it becomes `arguments[1]` in the
  emitted module — never read `arguments[1]` in this pass. Capacity resolution
  **reuses** `resolveIndexUpperBound` + `collectConstNumberEnv` (the same
  machinery that sizes a series index), so a numeric literal, a
  parenthesised/unary-`±` literal, an affine combination, and a `const`
  numeric binding (`const K = 20; state.array(K)`) all resolve; a `let`, an
  input, or any runtime value resolves to `null`. A `null` capacity (or a
  missing argument) errors `state-array-capacity-not-literal`; a resolved
  capacity that is `<= 0`, non-integer, or `> MAX_STATE_ARRAY_CAPACITY`
  (100_000) errors `state-array-capacity-exceeds-max`. Both are **errors** — a
  non-literal capacity breaks the bounded-snapshot guarantee. The pass is
  independent of `statefulCallInLoop`: a `state.array(...)` inside a loop
  collects both codes (acceptable, mirrors element-access multi-reporting).
- **No DOM lib.** `program.ts` pins `lib: ["lib.es2022.d.ts"]` on the
  in-memory program so scripts cannot rely on browser globals. Hostile
  globals (`Math.random`, `Date`, `fetch`, `setTimeout`, …) are
  separately rejected by `forbiddenConstructs`.
- **Core resolves through an ambient shim.** `program.ts` ships a
  hand-rolled `.d.ts` for `@invinite-org/chartlang-core` so the compiler
  is host-machine independent and deterministic. The shim must stay in
  lockstep with `packages/core/src/` — every new core export needs a
  matching declaration here. In particular the shim declares scalar `Bar`,
  the indexable `BarSeries` (OHLCV + derived fields as
  `PriceSeries`/`VolumeSeries` = `number & Series<number>`), and
  `ComputeContext.bar: BarSeries` — this is what makes a compiled script's
  `bar.close[1]` type-check while `bar.close * 2` / `plot(bar.close)` /
  `ta.ema(bar.close, …)` keep working. `extractMaxLookback` already
  recognises `bar.<ohlcv>[N]` textually (via `OHLCV_FIELDS`), so a direct
  `bar.close[N]` sizes the ring buffer with no analyser change.
  - **The render-order `z` option lives on a shim `ZOrdered` mixin.** Core's
    `z?: number` (the `plot-draw-z-order` feature) reaches the shim two ways:
    `PlotOpts` carries `z?` directly, and `ZOrdered = Readonly<{ z?: number }>`
    is intersected into **every** world-space `draw.*` opts type
    (`LineDrawStyle`, `ShapeStyle`, `HighlighterStyle`, `BrushStyle`,
    `TextOpts`, `ArrowMarkerOpts`, `FillBetweenStyle`, `FibOpts`,
    `RegressionTrendOpts`, `FrameOpts`; `ArrowOpts`/`PathOpts` inherit it via
    `LineDrawStyle`) — mirroring core's `drawingStyle.ts`. `TableOpts` is
    **excluded** (a viewport-HUD overlay, not part of the render sort — see
    core's `CLAUDE.md`). Without the mixin a
    `draw.*(…, { z })` callsite fails the semantic-typecheck gate with TS2353
    even though core accepts it. `z` is a type/contract addition only in the
    shim (no analyser change — it is not a series read); the omit-when-`0`
    emission + global render sort live in runtime / adapter-kit / the adapter.
  - **Overloaded shim namespaces are `interface`s, never `Readonly<{ … }>`
    object types.** `RequestNamespace` carries the two `security` overloads
    (data + expression form). `Readonly<T>` is a homomorphic mapped type, and
    mapping over a member with multiple call signatures **collapses the
    overloads to one** — so a `Readonly<{ security(opts): SecurityBar;
    security(opts, expr): Series<number> }>` shim makes the full `compile()`
    type-check reject `request.security({ interval }, (bar) => …)` with TS2554
    ("Expected 1 arguments, but got 2"). Declaring `RequestNamespace` as an
    `interface` preserves both arities. `transformAndAnalyse` (analysis-only)
    does NOT type-check, so the only guard against this is a `compile()`-based
    test (`compile.test.ts` → "type-checks the request.security expression
    overload through the ambient shim"). Any future overloaded namespace
    member must follow the interface pattern.
- **Callee resolution handles nested core namespaces.** `resolveCalleeName`
  must preserve full names such as `state.tick.float` in addition to
  one-hop names like `ta.ema`; callsite-id injection and loop diagnostics
  key directly on those registry names.
- **Determinism is testable.** `transformAndAnalyse(src, opts)` printed
  twice must yield byte-identical strings via `ts.createPrinter`. Slot
  ids are pure string literals, never template strings or symbol
  references. The same goes for `compile`'s `moduleSource` — esbuild's
  `transform` output is deterministic with fixed flags and the
  `__manifest` JSON keys land in `buildManifest` insertion order.
- **`__manifest` shape is `export const`.** `bundle.ts`'s
  `formatManifestAssignment` emits `export const __manifest = …;` so the
  runtime can recover the manifest via dynamic `import(...)`. The `.d.ts`
  sibling (`typesEmit.ts`) declares the symbol in lockstep — both halves
  must stay aligned.
- **`__dependencies` is prepended PRE-bundle, not appended.** The
  `export const __dependencies = [...]` line synthesised by
  `formatDependenciesAssignment` lands inside the source `compile()`
  hands to `bundleModule`. Cross-file `withInputs`-aliased bindings
  (`const trend = baseTrend;` after the chain rewrite) are bare
  references that esbuild's tree-shaker drops if nothing else
  references them — the export keeps each alias alive in the
  tree-shake. The dep-cross-file conformance scenario fails at load
  time if this contract regresses.
- **`compileFile` writes are atomic.** `writeAtomic` renders to a
  `<target>.tmp.<rand>` sibling and `rename`s into place; on failure the
  temp file is unlinked. Anyone touching `compileFile` must preserve this
  contract — half-written triples are worse than no triple.
- **`compileProject` does not write.** It walks the directory in
  parallel + collects results in memory. The CLI loops `compileFile`
  itself when sibling files are needed (Phase-1 Task 11).
- **`STATEFUL_PRIMITIVES` is a `ReadonlySet<{ name, slot }>` as of
  Phase-2 Task 5.** The shape widened from `ReadonlySet<string>` so
  `ta.nz` (the only stateless cross-functional primitive) can opt
  out of slot-id injection. `callsiteIdInjection` resolves the
  entry by name and skips the slot-id literal when `slot === false`;
  `statefulCallInLoop` flags every entry regardless of `slot`
  (Pine-parity — stateless primitives are still forbidden in loop
  bodies). Future per-port batches (Tasks 6–28) append `slot: true`
  entries; only `ta.nz` carries `slot: false`. The `program.ts`
  ambient shim mirrors the shape — keep the two in lockstep.
- **`manifest.plots[*].slotId` must equal the injected callsite
  literal.** `injectCallsiteIds` accumulates one `PlotSlotDescriptor`
  per `plot()` / `hline()` callsite using the *same* minted `slotId` it
  injects as the leading argument (never a second derivation) — the
  runtime echoes that literal as `PlotEmission.slotId`, so any drift
  silently breaks host-side override keying. The plot **kind** is NOT a
  callee member (chartlang has no `plot.*` member API); it is derived
  from the opts object literal's `style.kind` string literal
  (`plotKindFromCallsite`), mirroring the runtime's `buildStyle`. Bare
  `plot` (no `style`) ⇒ `line`; `hline` ⇒ `horizontal-line`; a dynamic
  / non-literal `style` ⇒ best-effort `line` (slot still listed). For
  multi-export files the flat plot-slot list attaches to the **default
  manifest only** (mirrors how `outputs?` scopes; per-export plot
  partitioning is deferred).
