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
  `callIndex = 0`; non-zero is reserved for future macros.
- **Static-analysis runs on the original AST.** `structuralChecks`,
  `forbiddenConstructs`, and `statefulCallInLoop` operate on the source
  file as parsed; the transformer is a pure rewrite step that never
  mutates input nodes. Extractors (capabilities / max-lookback / inputs)
  also run on the original AST — the rewrite is only for the bundler in
  Task 3.
- **`extractMaxLookback` counts the universal `opts.offset` as lookback
  depth.** A positive `offset` literal on a `ta.*` call shifts the output
  series so `series.current` reads `buf.at(offset)`; since the runtime
  sizes every output ring buffer to `maxLookback + 1`, the offset must
  raise `maxLookback` or the shifted read is permanently out-of-range
  NaN. It stacks with a literal element-access index on the same series
  (`shifted[N]` ⇒ `N + offset`). Negative offsets (future reads, NaN at
  the head) and non-literal offsets contribute `0` — they need no extra
  buffer depth / cannot be sized at compile time.
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
- **No DOM lib.** `program.ts` pins `lib: ["lib.es2022.d.ts"]` on the
  in-memory program so scripts cannot rely on browser globals. Hostile
  globals (`Math.random`, `Date`, `fetch`, `setTimeout`, …) are
  separately rejected by `forbiddenConstructs`.
- **Core resolves through an ambient shim.** `program.ts` ships a
  hand-rolled `.d.ts` for `@invinite-org/chartlang-core` so the compiler
  is host-machine independent and deterministic. The shim must stay in
  lockstep with `packages/core/src/` — every new core export needs a
  matching declaration here.
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
