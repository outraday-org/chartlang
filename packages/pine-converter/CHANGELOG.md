# @invinite-org/chartlang-pine-converter

## 0.1.0

### Minor Changes

- ca19e20: Bidirectional plot `offset` — negative offsets shift a plotted series left.

  `offset` becomes a presentation-only **display shift** in bars with the
  fixed sign convention `+n` = right (future), `−n` = left (past); the
  numeric series value is unshifted. This replaces the old value-read model
  (where a positive offset made `series.current` read the value N bars ago
  and a negative offset resolved to `NaN`). The `*Opts` `offset` JSDoc (and
  ALMA's `barShift`) now describe both directions and drop the old
  "negative ⇒ NaN" wording (`AlmaOpts.offset`, the Gaussian-centre
  position, is unchanged).

  `PlotEmission` gains an optional presentation field `xShift?: number`
  (signed integer bars; omitted/`0` ≡ no shift, so a no-shift emission is
  byte-identical to today). `validateEmission` rejects a non-integer
  `xShift`. The compiler no longer counts `offset` toward `maxLookback`
  (the value is no longer read from a deeper slot). The runtime threads the
  declared offset onto the emission as `xShift` (reading a
  `WeakMap<Series, number>` offset tag set by `makeShiftedSeriesView`; ALMA
  tags `opts.barShift`) and stops the old value-read shift so
  `series.current` is unshifted; the reference adapter renders it by
  projecting `xShift` onto the x-axis (extending the viewport for
  future-shifted points).

  The Pine converter now maps `plot(<ta.* call>, offset=N)` onto the
  emitted `ta.*` call's `offset` opt (signed, both directions); a plot
  whose value is not a direct `ta.*` call drops the offset and emits the
  new `plot-offset-needs-ta-call` warning, and a plot-level offset
  replacing the ta call's own `offset=` emits `plot-offset-overrides-ta-offset`.

  The conformance harness's `plot-field` assertion gains an `xShift` field,
  and a new scenario pins both shift directions plus the unshifted value
  series.

- 3bf391a: Add the `draw.fillBetween(edgeA, edgeB, opts?)` drawing primitive — a
  native filled ribbon between two edges (the closed polygon `edgeA`
  forward then `edgeB` reversed). It is the chartlang equivalent of Pine's
  `linefill.new(line1, line2, color)` / `fill(plot1, plot2)`. The
  pine-converter now lowers static two-line `linefill.new` to it instead of
  approximating with `draw.rotatedRectangle`, retiring the
  `linefill-rotatedrect-approximated` diagnostic.
- 656390d: Ship the converter CLI surface and finalize the programmatic API. Add
  `convertFile(path, opts?)` to `@invinite-org/chartlang-pine-converter`: an async
  file-system wrapper around `convert` that reads the input as UTF-8, threads
  `ConvertOpts` through, and — when `opts.outPath` is set and the conversion
  yields a non-null `output` — writes the converted `.chart.ts` to disk. File I/O
  failures reject the promise (host-environment errors, distinct from converter
  diagnostics). Adds the `ConvertFileOpts` type (`ConvertOpts & { outPath? }`).

  Add the `chartlang pine-convert <input.pine>` subcommand to
  `@invinite-org/chartlang-cli`, a thin in-process layer over `convertFile` + the
  `@invinite-org/chartlang-pine-converter/diagnostics` formatters. Flags:
  `--out <path>` (write to file, else stream to stdout), `--report` /
  `--diagnostics-json` (human report to stderr vs JSON to stdout), `--strict`,
  `--bar-interval <ms>`, `--bar-index-origin <ms>`. Exit codes: `0` success,
  `1` error-severity diagnostics, `2` file I/O failure, `3` invalid CLI args.

- 656390d: Land the codegen back end (`src/codegen/`) and wire the full conversion pipeline into the public `convert()`. `convert(pineSource)` now returns a real chartlang `.chart.ts` source string instead of throwing `ConverterNotReadyError`: it lexes, parses, runs the semantic analysis, drives the eight transform passes (declaration, inputs, the Camp A/B/C drawing lowerings, tables, polyline/linefill, control-flow), then emits the assembled `ScriptScaffold` IR through `emit(scaffold)`.

  `emit` is a deterministic, pure-templating string emitter: an auto-generated header, a minimized `@invinite-org/chartlang-core` import (only the surfaces the body references, plus `type DrawingHandle` when handles are used), and the `export default defineIndicator/defineDrawing({ … })` block with its options + `compute` body. The converter OWNS the drawing-handle helper definitions (`useDrawingHandleSlot`, `useDrawingHandleRing`) and the state/handle/ring allocations, all emitted INSIDE `compute` where `draw`/`state` are in scope — the emitted source compiles cleanly through `@invinite-org/chartlang-compiler` (verified by a round-trip smoke test). Adds `scaffoldToManifest` for the `ConvertManifest`, the `codegen-output-invalid` diagnostic code, and `@invinite-org/chartlang-compiler` as a workspace dependency.

- 48c1b76: Add the new `@invinite-org/chartlang-pine-converter` package — first slice of the Pine Script v6 → chartlang source-to-source converter (drawings v1). This release ships the §22.4 scaffold and the stable public-surface stub (`convert`, `ConvertOpts`, `ConvertResult`, `Diagnostic`, `DiagnosticSeverity`, `SourceSpan`, `ConvertManifest`, `ConverterCapabilities`, `ConverterNotReadyError`) so downstream tasks have pinned types to import. `convert(...)` throws `ConverterNotReadyError("lexer")` until the pipeline lands across Tasks 2–16.
- 8086003: Add an optional presentation-only `z` (render-order / z-index) option to
  `plot()` and every `draw.*` primitive. Default `0`; higher renders on
  top, ties fall back to the existing group + declaration order. Finite
  numbers only. Affects stacking only — values, alerts, and `state.*` are
  unchanged.

  Adapter kit: `PlotEmission` and `DrawingEmission` gain the matching
  presentation-only `z?: number` wire field, validated by
  `validateEmission` as a finite number (NaN / ±Infinity rejected;
  fractional and negative allowed). Omitted/`0` stays byte-identical to a
  pre-feature emission, so existing goldens and conformance hashes are
  untouched.

  Runtime: `plotImpl` reads `opts.z`, and the drawing-emit path
  (`createDrawingHandle`) lifts `z` out of `state.style` — into a shallow
  clone with `z` removed, where the per-kind `draw.*` impls fold the opts
  bag — and threads it onto the top-level `PlotEmission.z` /
  `DrawingEmission.z` with the same omit-when-`0` conditional spread used
  for `xShift`. `z` is persisted **beside** the drawing slot's `state`
  (never inside `DrawingState`), so an `update` retains the last value. A
  no-`z` plot or drawing emits no `z` key — byte-identical to the
  pre-feature baseline. `draw.table` / `draw.group` do not carry `z` in
  v1.

  Pine converter: `explicit_plot_zorder` is now a recognized no-op instead
  of an unmapped warning. chartlang already layers marks by declaration
  order within their group (the normative ordering contract), which is
  exactly what Pine's `explicit_plot_zorder=true` makes authoritative — so
  the flag is satisfied by default and needs no chartlang option.
  `mapDeclarationArgs` no longer raises `indicator-arg-not-mapped` for it;
  instead it emits a single `explicit-plot-zorder-default` info note
  (covering both `explicit_plot_zorder=true` and the Pine-default
  `=false`). The converter still never _emits_ a numeric `z` — Pine has no
  per-element z source construct. Other unmapped `indicator(...)` args
  (`timeframe`, etc.) keep warning.

  Compiler: the ambient `@invinite-org/chartlang-core` `.d.ts` shim gains a
  `ZOrdered { z?: number }` mixin intersected into `PlotOpts` and every
  `draw.*` option type (mirroring core's `drawingStyle.ts`), so a compiled
  script's `plot(value, { z })` **and** `draw.*(…, { z })` type-check (the
  shim stays in lockstep with core).

  Conformance: a new `z-order` scenario pins the plot `z` →
  `PlotEmission.z` wire contract — a `plot(value, { z: -1 })` emits
  `z: -1`, a no-`z` plot omits the field (omit-when-`0` byte-identity), and
  a value-hash proves `z` never transforms the series. The `plot-field`
  assertion's `field` union widens to also accept `"z"`.

- 073f41b: Add the higher-timeframe expression/callback overload to `request.security`.
  Alongside the existing data form `request.security({ interval })` →
  `SecurityBar`, scripts can now write `request.security({ interval }, (bar) =>
…)` → `Series<number>`, where the callback runs on the **higher-timeframe
  clock** — `request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 20))`
  is a true weekly EMA(20) (20 weekly bars), not 20 main bars of a weekly-stepped
  series. The result is aligned no-lookahead down to the main timeline.

  - **core** — the `SecurityExpr` callback type (re-exported from the package
    root), the second `security` overload, and the shared `statefulPrimitives`
    entry annotated as covering both arities.
  - **compiler** — records one `SecurityExpressionDescriptor { slotId, interval,
paramName }` per expression callsite in `manifest.securityExpressions`
    (sorted by `slotId`, omitted for the data-only form), and validates each
    callback against the allowed subset — its `bar` parameter and body locals,
    the ambient `ta` / `inputs`, safe `Math.*` globals, and literals — rejecting
    any captured outer binding with the new
    `request-security-expr-captures-local` diagnostic.
  - **runtime** — mounts one `SecurityExprRunner` per manifest entry: the
    callback is captured lazily on the first main compute, driven once per HTF bar
    close through a dedicated fold `StreamState` so `ta.*` accumulate on the HTF
    clock, and one sampled value per HTF bar feeds a per-slot output buffer that
    `request.security(opts, expr)` returns aligned no-lookahead to the main
    timeline. Capability / interval / stream fallbacks return an all-NaN series
    with a deduped diagnostic.
  - **host-worker / host-quickjs** — boot the expression form unchanged; the
    `__manifest` sidecar already carries `securityExpressions`.
  - **pine-converter** — Pine's `request.security(sym, "D", ta.ema(close, 9))`
    now lowers to the chartlang callback form
    `request.security({ interval: "1d" }, (bar) => ta.ema(bar.close, 9))` (a bare
    OHLCV third arg keeps lowering to the data form).
  - **conformance** — new scenarios prove the weekly expression value differs
    from a same-length main-timeframe EMA, plus the `multiTimeframe: false` NaN
    fallback.

- 5a9c24d: Lower a history-indexed numeric Pine `var`/`varip` scalar to `state.series`
  instead of the non-compiling `state.float`/`int` + `<slot>.value[n]`. Pine's
  pervasive `var x := …; x[1]` idiom now converts to working chartlang (`const x =
state.series(<init>); … x.value = …; x[1]`). A numeric `var` never read with
  `[n]` keeps its leaner scalar slot. A `bool`/`string` history-indexed `var`
  stays out of v1 scope with a clear `series-history-non-numeric` diagnostic, and a
  non-literal series offset wires the `dynamic-series-index` error.
- 5a9c24d: Add `state.series(init)` — a writable, indexable user series. Store an
  arbitrary value each bar (`s.value = expr`) and read its history N bars
  back (`s[1]`). Number-coercible (`+s`, `s.current`) and usable as a `ta.*`
  source. The Pine converter lowers a history-indexed `var` to it.
- 08c536c: Add the `ta.highestbars` / `ta.lowestbars` primitives plus the cross-package
  wiring that makes them usable as drawing anchors and Pine-converter targets.

  - **core / runtime:** `ta.highestbars(source, length, opts?)` and
    `ta.lowestbars(source, length, opts?)` return the bar OFFSET (≤ 0) to the
    highest / lowest `source` value over the trailing `length` bars (window
    INCLUDES the current bar). `0` → current bar is the extreme; `-k` → the
    extreme occurred `k` bars ago. Ties resolve to the most recent bar; NaN
    inputs are skipped; warmup is `length − 1` bars; tick-mode replays the
    in-progress head as the offset-0 candidate. Registered in
    `STATEFUL_PRIMITIVES` (now 174 entries) and `TA_REGISTRY` (now 96 entries).
  - **compiler:** a literal-length `ta.highestbars` / `ta.lowestbars` call
    contributes `length − 1` toward `maxLookback`, so the runtime sizes the time
    ring buffer deep enough for a `bar.point(<that offset>, …)` anchor to resolve.
    A non-literal length contributes 0.
  - **pine-converter:** `ta.highestbars` / `ta.lowestbars` now map to the real
    chartlang primitives (previously lossy passthroughs to `ta.highest` /
    `ta.lowest`). **Behavior change:** a DYNAMIC `bar_index + <non-literal>`
    drawing-x anchor no longer raises the hard `requires-bar-interval` error —
    the offset is resolved by `bar.point` at runtime sign-agnostically (a
    negative runtime offset, e.g. what `ta.highestbars` returns, resolves to the
    historical timestamp via the time buffer). Only the literal `bar_index + N`
    future case still requires a bar interval.
  - **conformance:** new `TA_HIGHEST_LOWEST_BARS_SCENARIO` export pins both
    primitives end-to-end through the compiler + runtime over the bundled
    `goldenBars.json` fixture, and is added to `ALL_SCENARIOS`.

### Patch Changes

- 850ae21: Add `bar.point(offset, price)` — index authoring sugar for anchoring drawings
  by bar offset instead of an absolute timestamp.

  `bar.point` resolves the offset to the existing time-based `WorldPoint`
  (`{ time, price }`) at compute time, so it composes directly with every
  `draw.*` anchor argument and introduces no new wire format or anchor union:

  - `bar.point(0, price)` — the current bar.
  - `bar.point(-n, price)` — `n` bars back, using the real historical timestamp
    from the runtime's time ring buffer (`NaN` time past retained history; never
    throws).
  - `bar.point(n, price)` — a future bar, with the time extrapolated from the
    median recent bar spacing (falling back to the parsed bar interval when
    fewer than two bars are retained).

  The compiler's max-lookback analysis now counts a negative integer-literal
  `bar.point(-n, …)` offset toward `maxLookback` exactly like a `series[n]`
  lookback, so the runtime sizes the time buffer deeply enough; positive (future)
  offsets and dynamic offsets contribute no extra depth. The recogniser peels
  parentheses, so the converter's emitted form `bar.point(-(n), …)` is sized
  identically to a hand-written `bar.point(-n, …)` (without it, a converted
  historical tracking line sized its buffer to 0 and resolved to a NaN anchor).

  The Pine v6 converter now lowers `bar_index` drawing anchors to
  `bar.point(<signed offset>, <price>)` and drops the dead `__BAR_INTERVAL_MS`
  sentinel and its `bar.time ± (N * __BAR_INTERVAL_MS)` arithmetic — future
  anchors resolve at runtime instead of needing a host-supplied bar interval.

- 850ae21: Compact codegen for the common single-persistent-handle Camp A case. A plain
  `var <drawingType> h = na` handle that is created once and mutated each bar (no
  `*.delete`, not `varip`) now lowers to a bare `const <local> = draw.<kind>(…)`
  create + `<local>.update(…)` patch, exploiting the runtime's callsite-
  persistence instead of emitting the `useDrawingHandleSlot`/`__HandleSlot`
  generic helper, the `current()`/`set()` slot indirection, and the
  `DrawingHandle` type import. The emission-level behaviour is byte-identical
  (verified against the golden corpus and the compiler round-trip). Anything
  outside the clean idiom — a `*.delete`, a `varip` handle, tables, static
  polyline/linefill, and Camp B/C rings — falls back to the general slot
  machinery.
- 656390d: Move `@invinite-org/chartlang-compiler` from `dependencies` to
  `devDependencies`. The synchronous `convert` pipeline (lex → parse → semantic →
  transform → codegen) never imports the compiler — it is used only by the
  `emit-compile.test.ts` round-trip that verifies emitted output compiles. Keeping
  it as a runtime dependency wrongly pulled the compiler (and its esbuild/Node
  surface) into downstream bundlers' resolution graph; a devDependency is
  sufficient for the tests and keeps the runtime dependency set empty.
- b55d4c8: Add the package-internal coordinate resolver (`src/transform/coordinates.ts`) that bridges Pine's bar-index coordinate model to chartlang's absolute `(time, price)` `WorldPoint` anchors. `resolveCoordinates(semantic, opts)` walks every coordinate-bearing drawing call-site (`line.new`/`box.new`/`label.new`) and produces a `ReadonlyMap<ExpressionNode, ResolvedAnchor>` side-table the Task 16 codegen renders verbatim — the AST is never mutated. Anchors classify into literal world points, `xloc.bar_time` pass-throughs, historical `bar_index` / `bar_index[N]` / `bar_index - N` offsets, future `bar_index + N` anchors (flagged `requiresBarInterval`), and the four `chart.point.*` factory forms. A future `bar_index + N` anchor with a null `barInterval` raises a single `requires-bar-interval` error.

  Ships the Pine-expr → chartlang-TS-string emitter (`src/transform/exprEmit.ts`) that lowers every Pine expression node — remapping OHLCV/`time`/`bar_index` identifiers (`src/mapping/builtinIdentifiers.ts`), `and`/`or`/`not` to `&&`/`||`/`!`, and the context-sensitive `na` sentinel to `null` (handle) or `Number.NaN` (numeric) from its semantic annotation. Adds four `pine-converter/transform/...` diagnostic codes (`requires-bar-interval`, `dynamic-bar-index`, `unresolved-bar-index`, `chart-point-from-index-without-xloc`).

- 656390d: Formalize the diagnostics framework. Consolidate every Task 3–16 diagnostic into a single registry: `DIAGNOSTIC_CODE_ENTRIES` keeps the by-short-key object (driving `ParserDiagnosticCode`, `makeDiagnostic`, and the once-per-script dedup in Camp A/B), and a new `DIAGNOSTIC_CODES` exposes the same entries as a `ReadonlyMap<string, DiagnosticCodeEntry>` keyed by the full, stable code STRING for reporting code that only sees a `Diagnostic.code`. No code string changed — the strings remain the converter's stable public contract.

  Add the read/format side under `src/diagnostics/`: `DiagnosticReport` (a read-only wrapper over `readonly Diagnostic[]` with `errors()`/`warnings()`/`infos()`/`all()`/`frozen()`/`upgradeWarningsToErrors()`, distinct from the transform-layer mutable `DiagnosticCollector`), plus `formatDiagnostic` (rustc/tsc-style line+caret excerpt with a docs link), `formatDiagnosticReport` (grouped, counted report), and `formatDiagnosticsJson` (stable property order). `convert(source, { strictMode: true })` now honors the documented option by upgrading every warning in `ConvertResult.diagnostics` to an error (severity-only; `output` is unchanged — strict callers detect failure by scanning for any error). Adds a TS-Compiler-API test asserting every pushed diagnostic key is registered and a span-propagation property test over 30+ fixtures.

- 656390d: Add the Pine → chartlang end-to-end test suite: a 20-fixture Pine v6 corpus with
  byte-exact `.expected.chart.ts` + diagnostics goldens (generated from real
  `convert()` runs, regen via `UPDATE_FIXTURES=1`), determinism + strict-mode
  golden tests, and three conformance round-trip scenarios
  (`pine-converter-round-trip-camp-a`/`-camp-b`/`-table`) that ingest a Pine
  fixture, run `convert()`, compile the output through the chartlang compiler, run
  it through the runtime, and pin the full drawing-emission stream as a
  `drawing-hash`.
- 48c1b76: Add the package-internal Pine Script v6 lexer (`src/lexer/`). `lex(source)` tokenizes Pine v6 — keywords/identifiers, member access, int/float/scientific/hex numerics with `_` separators, single/double-quoted strings with escapes, `#RRGGBB[AA]` colors, operators/punctuation, line comments, and the `//@version=N` directive — and models Pine's significant indentation with synthetic `newline`/`indent`/`dedent` tokens (line-continuation aware via bracket depth and trailing commas). Malformed numerics, unterminated strings, invalid colors, illegal characters, and mixed/inconsistent indentation surface as structured `LexerDiagnostic`s rather than throwing. The lexer is package-internal (consumed by the Task 3 parser) and is not re-exported from the package root.
- 48c1b76: Add the declarative Pine v6 → chartlang mapping tables under
  `src/mapping/`: drawing constructors + setters, style enums, `input.*`
  primitives, and `ta.*` / `math.*` passthrough. Each table is an immutable
  lookup with a `chartlang: null` REJECT marker and a shared `lookup` helper
  that collapses missing keys and REJECTs to `null`. Every chartlang target
  symbol is verified against `@invinite-org/chartlang-core`.
- b55d4c8: Replace the Task 3 expression stub with a full Pine v6 Pratt expression parser in `src/parser/expressions.ts`: precedence-climbing for binary operators (`or` < `and` < equality < relational < additive < multiplicative), prefix unary (`+`/`-`/`not`), and the precedence-9 postfix operators — function calls with positional-then-named args, the history-reference operator `series[N]` (chainable, left-associative), and member access `a.b.c`. Identifiers, every literal kind, `na`, booleans, parenthesized groups, tuples `(a, b)`, and lambdas `(x) => expr` are the primary forms. The `ExpressionNode` union (`src/ast/expressions.ts`) expands accordingly. The top-level statement loop hard-rejects UDT (`type`), `method`, and library `import` declarations with the new `unsupported-udt` / `unsupported-method` / `unsupported-library-import` diagnostics and recovers past the whole block. Calls flag a positional argument after a named one with `mixed-named-positional-args`, and a chained ternary emits the informational `chained-ternary-warning`. A latent bug where the assignment parser left the `=`/`:=` operator unconsumed (masked by the greedy stub) is fixed. The parser still never throws; every `Expression` slot routes through the same `parseExpression(ctx)` entry, and an `unparse` round-trip helper backs the property tests.
- 48c1b76: Add the package-internal Pine Script v6 AST (`src/ast/`) and recursive-descent parser (`src/parser/`) for top-level declarations and statements. `parseStatements(tokens)` consumes the lexer's token stream and produces a `Script` AST plus structured diagnostics: it parses the `//@version=6` directive, `indicator(...)` declarations (rejecting `strategy(...)`/`library(...)` with `unsupported-strategy`/`unsupported-library` but still walking the body), `var`/`varip`/typed/bare variable declarations, `=`/`:=` assignments, `if`/`else if`/`else`, literal-bounded `for` loops, `switch`/`=>` arms, and `break`/`continue`/`return`. `for ... in` and `while` are rejected with `unsupported-for-in`/`unsupported-while` and the parser recovers past the whole compound statement. Expression slots are filled by an `UnknownExpression` stub (Task 4 substitutes the real expression grammar); every node carries a 1-based `SourceSpan` and the parser never throws. A single-source diagnostic-code registry lands in `src/diagnostics/codes.ts`. The parser and AST are package-internal and not re-exported from the package root.
- 850ae21: Broaden the plot-family and `ta.*` lowering: `plotshape`/`plotchar`/`plotarrow`
  map `location`/`style`/`char` enums, `ta.pivothigh`/`ta.pivotlow` project the
  `ta.pivotsHighLow` result fields, `input.*` reads carry an `as <type>` cast,
  generic type annotations (`array<line>`) parse, a standalone `polyline.new`
  lowers, and a fully-dead `if` (all branches owned-drawing-only) is dropped. A
  `ta.*` boolean used directly as a `plotshape`/`plotchar`/`plotarrow` condition
  now lowers with `.current` so the shape gates on the per-bar scalar instead of a
  perpetually-truthy `Series` object. New fixtures 21–24 exercise the SMA overlay,
  ATR pane, RSI bands, and EMA-cross conversions through the compile round-trip
  gate.
- 850ae21: Readable synthesized identifiers in the generated `.chart.ts`. The blanket
  `__` prefix is gone: a persistent handle from `var line trail = na` is now
  emitted as `const trail = draw.line(…)` (the Pine identifier reused), rings as
  their collection name, scalar state slots as their Pine name, the bar-index
  bridge as `barCount`/`barIndex`, the drawing-handle helper as
  `HandleSlot`/`useDrawingHandleSlot`/`HandleRing`/`useDrawingHandleRing`, and
  inline inputs as `inlineInput`. A new scope-aware `NameAllocator`
  (`transform/nameAllocator.ts`) seeds every in-scope identifier (compute-context
  params, JS reserved words, every Pine symbol) and disambiguates a clash with a
  numeric suffix (`trail2`) — never by reintroducing `__`. Output is purely
  lexical-renamed; runtime emissions are unchanged.
- b55d4c8: Add the package-internal semantic-analysis stage (`src/semantic/`) that walks the Pine v6 AST and produces the annotated `SemanticResult` every downstream transform (Tasks 8–15) consumes. It builds a scope tree seeded with the Pine v6 built-in symbol table, infers each expression's qualifier on the `const < input < simple < series` lattice, infers the `na` flavour (numeric sentinel vs drawing-handle `null`), disambiguates `=` declarations from accidental shadowing and `:=` reassignments, tracks `var`/`varip` lifetimes (reassignment / setter-mutation / delete sites), detects historical and future `bar_index` references, and — the load-bearing output — classifies every `line.new`/`label.new`/`box.new`/`polyline.new`/`linefill.new` call-site into Camp A (single handle), Camp B (bounded ring buffer with an extracted cap), Camp C-bounded (indicator-capped heuristic), or Camp C-unbounded (hard-reject). Six semantic diagnostics are added under `pine-converter/semantic/...`. Tuple destructuring (`[a, b] = f()`) is reported as out-of-v1-scope rather than wired into the parser, since the multi-return Pine surfaces are deferred for the drawing slice.
- 656390d: Add the Camp A drawing transform (`src/transform/campA.ts`) plus the reusable handle-slot + setter-fold infrastructure Task 11 (Camp B) shares. `transformCampA(site, analysis, scaffold, diagnostics)` lowers a single `var`/`varip` drawing handle created once and mutated each bar into chartlang's mutable `DrawingHandle` model: it registers a module-level handle slot (`appendHandleSlot({ name: "__<pine>_handle", kind })`, whose allocation + helper Task 16 codegen emits), synthesises a guarded `slot.set(draw.<kind>(...))` creation, folds every observed `*.set_*(handle, …)` mutation per straight-line block into one `slot.current()?.update({...})`, and emits `slot.current()?.remove(); slot.set(null);` at each `*.delete(handle)`.

  Ships the shared primitives `synthesizeDrawCall` / `handleSlotLocalName` (`src/transform/handleSlot.ts`), `foldSetters` / `renderEnumTarget` (`src/transform/setterFold.ts`), `resolveCampADrawKind` (`src/transform/drawKindResolve.ts`), `resolveYloc` (`src/transform/ylocResolve.ts`), and the new coordinate helpers `resolveAnchorExpr` / `anchorToWorldPoint` (`src/transform/coordinates.ts`). `label.new` maps to `draw.text` by default, or `draw.marker` / `draw.frame` / `draw.arrowMark{Up,Down}` per its `style=label.style_*` enum; `box.new` → `draw.rectangle`; `yloc.abovebar`/`belowbar` lower to bar-range padding arithmetic. Adds six `pine-converter/transform/...` diagnostic codes (`yloc-padding-approximated`, `varip-approximated`, `cross-mount-state-not-preserved`, `label-style-not-mapped`, `setter-fold-cross-branch`, `set-path-unsupported`).
  </content>

- 656390d: Add the Camp B drawing transform (`src/transform/campB.ts`) that lowers the bounded ring-buffer Pine idiom — a `var array<line|label|box>` filled by `array.push(coll, <draw>.new(...))` with FIFO eviction (`if array.size(coll) > K → *.delete(array.shift(coll))`) — into a chartlang ring buffer. `transformCampB(site, analysis, scaffold, diagnostics)` registers a module-level ring (`appendHandleRing`, whose `useDrawingHandleRing<K>(cap)` allocation + helper Task 16 codegen emits), emits exactly ONE `<ring>.push(draw.<kind>(...))` callsite at the fixed source position of the Pine `array.push` (inside its original guard, so the compiler's `stateful-call-inside-loop` gate never sees a `draw.*` in a loop), elides the explicit eviction block, and lowers each `for i = 0 to array.size(coll) - 1` update loop into a literal-bounded `for (… i < K …) { <ring>.at(i)?.update(...) }`. The ring capacity is `K = min(pineCap, CHARTLANG_BUCKET_CAP[bucket])` (lines/boxes/labels 500, polylines 100).

  Ships the reusable ring synthesis (`ringLocalName` / `registerRing` / `resolveRingCap` / `CHARTLANG_BUCKET_CAP`, `src/transform/ringHelper.ts`) and the `array.*` → ring accessor mapping (`mapArrayBuiltin`, `src/transform/arrayBuiltinMap.ts`) that Camp C (Task 12) and the table transform (Task 13) reuse: `array.first`→`at(0)`, `array.last`→`at(size()-1)`, `array.get(coll, i)`→`at(i)`, `array.size`→`size()`. Adds six `pine-converter/transform/...` diagnostic codes (`ring-eviction-implicit`, `cap-mismatch`, `anchor-mirror-required`, `ring-buffer-zero-cap`, `negative-array-index`, `linefill-over-ring`). `array.get(coll, -1)` rejects with `negative-array-index`; `linefill.new` over ring elements rejects with `linefill-over-ring` (Camp C territory); polyline collections are deferred to Task 14.

- 656390d: Add the Camp C drawing transform (`src/transform/campC.ts`) — the converter's safety net for dynamic drawing collections that don't fit the Camp B ring model. `transformCampC(site, analysis, scaffold, diagnostics)` self-filters to the two camp-c kinds the semantic classifier emits and either folds a reducible site into a bounded ring (REUSING `transformCampB` via a synthetic camp-b view of the same `.new()` call — no duplicated ring synthesis) or emits exactly one structured hard-reject with a context-specific suggested rewrite plus a `// [pine-converter] HARD-REJECT (...)` comment compute statement so no site is ever silently dropped.

  Ships three reducibility heuristics (`src/transform/campCHeuristics.ts`, `tryHeuristics`): **H1 implicit-cap-from-indicator** reads the chosen `K` from the scaffold's clamped `maxDrawings` for a `camp-c-bounded` site (Pine FIFO-evicts at the indicator cap anyway); **H2 bounded-by-loop-bound** recovers a literal / `input.int` `for i = 0 to L` bound around the push; **H3 single-use-collection** counts straight-line pushes. A heuristic returns `null` rather than guessing whenever the cap or push collection cannot be proven from the AST, and a fold only lands when the collection resolves at the root scope.

  Ships the reject registry (`src/transform/campCRejects.ts`, `CAMP_C_REJECTS` / `rejectSuggestion`) mapping each obstacle to a `SuggestionFn` templated over the inferred `K` and collection identifier. Adds seven `pine-converter/transform/...` diagnostic codes (`camp-c-heuristic-applied`, `dynamic-handle-index`, `cross-collection-linefill`, `polyline-dynamic-points`, `handle-copy`, `handle-store-in-udt`, `for-in-line-all`); the `unbounded-handle-collection` reject reuses the existing semantic-stage code. Strict-mode `output: null` suppression is left to Task 16 codegen, which reads the `error`-severity rejects + reject comments.

- 656390d: Add the control-flow + passthrough transform (`transformOther`), the last
  stage that populates the converted `compute` body for every non-drawing Pine
  statement: `if`/`else if`/`else`, literal- and `input.int`-bounded `for`
  (unrolled when the body calls a stateful primitive), `switch`/`case`,
  ternaries, scalar `var`/`varip`/`:=` lowered to `state.*` slots, `ta.*` /
  `math.*` / `str.*` passthrough, the `plot`/`plotshape`/`hline`/`bgcolor`
  family, `request.security` single-symbol MTF reads, and strategy-as-indicator
  signal alerts. Drawing statements already owned by the Camp A/B/C, table, and
  polyline/linefill transforms are skipped so the body never double-emits a
  drawing or lands a `draw.*` inside a loop.
- b55d4c8: Add the package-internal declaration transform that rewrites a Pine top-level `indicator(...)` / `strategy(...)` into the converter's `ScriptScaffold` IR — the mutable cross-task contract Tasks 9–15 populate. `transformDeclaration(decl, analysis, diagnostics)` (`src/transform/declaration.ts`) picks `defineIndicator` vs `defineDrawing` by scanning the body for plot-family calls (`plot`/`plotshape`/…/`hline`/`fill`/`bgcolor`/`barcolor`) vs drawing call-sites, downgrading to `defineDrawing` with a `drawing-only-script` info diagnostic when only drawings are emitted, and synthesizes a `defineIndicator` shell for `strategy(...)` (dropping backtester args, preserving `max_*_count`) with a `strategy-as-indicator` info. The §2 arg map (`src/transform/declarationArgs.ts`) lowers `title`/`shorttitle`/`overlay`/`format.*`/`precision`/`scale.*`/`max_*_count`/`max_bars_back` to chartlang options, defaults each `max_*_count` bucket to 50, clamps over-cap buckets (`max-count-out-of-range`), and warns on every unmapped arg (`indicator-arg-not-mapped`). A computed (non-literal) title raises `computed-indicator-title` and falls back to `"<unknown>"`.

  Introduces the shared `DiagnosticCollector` (`src/transform/diagnosticCollector.ts`) — a mutable `push`/`pushCode`/`has`/`toArray`/`size` accumulator that the `void`-returning Tasks 10–15 push into — and the `ScriptScaffold` IR (`src/transform/ir.ts`) plus its single mutation surface `appendInput`/`appendStateSlot`/`appendComputeStatement`/`appendHandleSlot`/`appendHandleRing` (`src/transform/scaffoldMutators.ts`). Adds five `pine-converter/transform/...` diagnostic codes (`indicator-arg-not-mapped`, `drawing-only-script`, `strategy-as-indicator`, `computed-indicator-title`, `max-count-out-of-range`). All new symbols re-exported from `src/transform/index.ts`.

- 656390d: Add the package-internal `input.*` transform that lowers every Pine `input.int`/`float`/`bool`/`string`/`color`/`source`/`symbol`/`timeframe`/`time`/`price`/`text_area` declaration into a chartlang `input.*(...)` source string appended to the `ScriptScaffold`'s `inputs` array. `transformInputs(analysis, scaffold, diagnostics)` (`src/transform/inputs.ts`) walks the analysed script body (including `if`/`for`/`switch`/block bodies and nested expression trees), keying a named declaration (`len = input.int(20)`) by its bound name and promoting an inline call (`ta.ema(close, input.int(20))`) to a synthesised `__input_<n>` name with an `inline-input-promoted` info. It consumes the Task 6 `INPUT_MAP` (`input.timeframe` → `input.interval`, `input.text_area` → `input.string` + `multiline: true`), maps `minval`/`maxval`/`step` → `min`/`max`/`step`, lowers `input.source` OHLCV built-ins to `SourceField` string literals, and accepts compile-time-literal defaults (including unary `+`/`-` on a numeric literal).

  Adds `src/transform/timeframeConvert.ts` with bidirectional `pineTimeframeToInterval` / `intervalToPineTimeframe` helpers (reused by Task 15's MTF support) and six `pine-converter/transform/...` diagnostic codes: `input-enum-rejected`, `unknown-input-primitive`, `non-literal-source-input`, `non-literal-input-default`, `input-arg-not-mapped`, and `inline-input-promoted`. `transformInputs` and the timeframe helpers are re-exported from `src/transform/index.ts` (package-internal).

- 656390d: Add the polyline + linefill transform (`src/transform/polylineLinefill.ts` + `src/transform/colorConvert.ts`). `transformPolylineLinefill(analysis, scaffold, diagnostics)` self-filters the `polyline.new` and static `linefill.new` drawing sites and lowers them into the `ScriptScaffold` IR.

  Polylines map to `draw.polyline` (straight), `draw.curve` (a 3-anchor `curved=true`), or `draw.path` with `closed: true` (a closed loop). Because the parser does not support Pine's `[...]` square-bracket array literal, the reachable anchor source is the `var array<chart.point>` build idiom: a literal-bounded `for i = 0 to N` loop that `array.push`es `chart.point.*` values unrolls (iterator-substituted) into a fixed anchor list rebuilt each `barstate.islast` tick; a non-literal (data-driven) bound is the finalised `polyline-dynamic-points` reject. A `>3`-anchor `curved=true` falls back to `draw.polyline` with a warning; `polyline.delete` emits the remove + slot-clear pattern.

  Static two-line `linefill.new(lineA, lineB, color)` is approximated as a filled `draw.rotatedRectangle(quad, { fill, fillAlpha })` over the two referenced lines' endpoints — `draw.path`/`PathOpts` carries no fill, so `ShapeStyle` on a rotated rectangle is the only fill-capable arbitrary-quad primitive. `linefill.set_color` folds into a style update, `linefill.delete` clears the slot, and a bar-by-bar two-series fill additionally raises `linefill-series-fill`. The shared `convertColor` / `transpToAlphaHex` helpers fold `color.new(base, transp)` into a `#RRGGBBAA` hex (`color.new(color.gray, 80)` → `#787B8633`).

  `transformCampC` now early-returns on `polyline.new` and the static (non-`array.get`) `linefill.new` so Task 14 solely owns them; a collection-driven `linefill.new(array.get(...))` cross-collection fill remains a Camp C `cross-collection-linefill` reject. Adds five `pine-converter/transform/...` diagnostic codes: `polyline-curved-anchors-warning`, `polyline-closed-info`, `linefill-series-fill`, `linefill-color-transp-approximated`, `linefill-rotatedrect-approximated`.

- 656390d: Add the tables transform (`src/transform/tables.ts`) — translates Pine's mutable-builder table API (`table.new` + `table.cell` + `table.cell_set_*` + `table.merge_cells` + `table.clear` + `table.delete`) into chartlang's immutable functional `draw.table({ position, cells })`. `transformTables(analysis, scaffold, diagnostics)` self-filters the `camp-a` `table.new` sites (one persistent handle per `var table`/`varip table`, REUSING the Camp A handle-slot naming via `handleSlotLocalName`), collects every observed `(col, row)` cell write into a last-write-wins map, and emits one `rows × columns` 2D `cells` array literal rebuilt each `barstate.islast` tick. `table.new` sites are NOT routed through `transformCampA` (its `draw.*` synthesis has no `table` method); Task 16 codegen hands them to this transform.

  Position and cell styling enums (`position.*`, `text.align_*`, `size.*`, `color.*`) lower through the shared mapping table; loop-driven cell writes (`for i = 0 to N`) unroll with literal-iterator substitution (`close[i]` → `bar.close[2]`); `merge_cells` keeps the top-left cell and blanks the span; `clear` is a rebuild-each-bar no-op; `delete` emits the slot-clear pattern; and the `other` drawing-bucket cap is widened to the table count. Adds seven `pine-converter/transform/...` diagnostic codes (`table-multi-init`, `table-cell-out-of-bounds`, `table-dynamic-loop`, `table-merge-fallback`, `table-clear-noop`, `table-bucket-cap-adjusted`, `table-formatting-not-mapped`). The core `draw.table` cell model (`text` + `bgColor`/`textColor`/`textHalign`/`textValign`/`textSize`) matches Pine's grid cleanly; only merge and Pine's `text_formatting`/`text_font_family`/`text_wrap` lack an analogue and are handled by fallback + warning.

- 850ae21: Promote every remaining `@experimental` symbol to `@stable`. The entire
  `pine-converter` public surface, the three `pineConverterRoundTrip*` conformance
  scenarios, and `runtime/barPoint.ts` now carry the stable maturity marker.
  Annotation-only — no behavior, API, or output changes; goldens and conformance
  reports are byte-identical. The hand-authored `docs/converter/index.md`
  stability line is updated to match.
