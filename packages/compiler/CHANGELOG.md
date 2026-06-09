# @invinite-org/chartlang-compiler

## 0.5.0

### Phase 5

#### Minor Changes

- Ship Phase 5 color helpers from PLAN §11.4: `color.fromGradient`, `color.withAlpha`, `color.rgb`, and `color.hsl`.
- Add canonical StateSnapshot, StreamSnapshot, and StateStoreKey type declarations for PLAN.md §6.1 and §6.9 persistence.
- Ship Phase 5 `defineAlertCondition`, compiler manifest extraction, runtime `signal()` emissions, adapter validation, and conformance coverage per PLAN §11.2.
- Add `draw.table` with `TableCell`/`TablePosition` types, runtime emission,
  viewport-anchored canvas2d rendering, and conformance coverage per PLAN §10.2.
- Add Phase 5 plot kinds, runtime emission dispatch, validation, conformance scenarios, and canvas2d reference renderers.
- Add `ta.fixedRangeVolumeProfile`, completing the Phase 5 volume-profile set
  from PLAN §9.2 and §10.1.1 with fixed `[from, to]` anchors, frozen post-range
  histograms, and `fixed-range-inverted` diagnostics. Ported from invinite
  commit `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4`.
- Port `ta.sessionVolumeProfile` from invinite commit 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4, adding the PLAN §9.2 horizontal-histogram session volume-profile primitive, PLAN §4.8 syminfo-session fallback diagnostics, and compiler/runtime registration.

#### Patch Changes

- Add `ta.visibleRangeVolumeProfile` per PLAN §9.2, ported from invinite commit `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4`, with runtime histogram emission, compiler/core type surfaces, conformance coverage, and generated docs.
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @invinite-org/chartlang-core@0.5.0

## 0.4.0

### Minor Changes

- 3f3ce38: Phase-1 AST surface: `transformAndAnalyse(source, opts)` driver that runs the
  TS program builder, the structural / forbidden-construct / stateful-call-in-loop
  checks, the §5.5 callsite-id injection transformer, and the capability /
  maxLookback / input extractors, then assembles a deeply-immutable
  `ScriptManifest`. Public `CompileDiagnostic` + `CompileDiagnosticCode` types
  cover all nine Phase-1 codes (`unbounded-loop`, `recursion-not-allowed`,
  `hostile-global`, `stateful-call-inside-loop`, `dynamic-series-index`,
  `callsite-id-conflict`, `missing-default-export`, `api-version-mismatch`, plus
  the reserved `request-security-interval-not-literal`). Bundling and the public
  `compile` / `compileFile` / `compileProject` API land in Task 3.
- 3f3ce38: Phase-1 public compile API: `compile(source, opts)`, `compileFile(path, opts)`,
  `compileProject(rootDir, opts)` wrap the Task-2 transformer + analysis driver
  and feed the printed AST through esbuild to produce the `.chart.js` +
  `manifest.json` + `.d.ts` triple per §5.2 / §5.3. Adds `CompileError` carrying
  the full diagnostic array, `bundleModule` + `formatManifestAssignment` (esbuild
  driver), `emitTypes` (minimal `.d.ts` generator), and `writeAtomic` +
  `walkChartFiles` helpers. `compileFile` writes the triple atomically via
  tmp + rename; sourcemaps support `false` / `"inline"` / `"external"`. The
  sibling docs-check gate now compiles every qualifying `@example` block through
  the compiler — `EXEMPT_EXPORTS` is empty, and placeholder packages keep a
  JSDoc'd `PACKAGE_VERSION` shim until their Phase-1 tasks land.
- b0d296b: Phase 3 closeout — `0.3` "Full Drawing Parity".

  61 drawing kinds across 13 categories ship under `draw.*` with the
  full §22.10 set per kind (impl + property + golden + bench + JSDoc

  - conformance scenario + auto-generated docs page). 5-bucket
    `DrawingCounts` budget, per-kind capability gating, `DrawingHandle`
    across-bar stability, real-impl `validateEmission` + `decodeDrawing`,
    `drawing-hash` conformance assertion variant, 13 category + 1
    umbrella capability builders, canvas2d reference adapter renders
    every kind, `defineDrawing` constructor for interactive tools.

  Final cardinalities: `STATEFUL_PRIMITIVES.size === 154` (93 Phase-2

  - 61 Phase-3 `draw.*` entries); `DRAWING_KINDS.length === 61`.

  Per-bucket kind tally pinned by `bucketFor` (6 + 5 + 6 + 25 + 19 = 61):

  - `lines` (6): `line`, `horizontal-line`, `horizontal-ray`,
    `vertical-line`, `cross-line`, `trend-angle`.
  - `boxes` (5): `rectangle`, `rotated-rectangle`, `triangle`,
    `circle`, `ellipse`.
  - `labels` (6): `marker`, `text`, `arrow`, `arrow-marker`,
    `arrow-mark-up`, `arrow-mark-down`.
  - `polylines` (25): `polyline`, `path`, `arc`, `curve`,
    `double-curve`, `pen`, `highlighter`, `brush`,
    `trend-channel`, `flat-top-bottom`, `disjoint-channel`,
    `regression-trend`, `pitchfork`, `pitchfan`, `xabcd-pattern`,
    `cypher-pattern`, `head-and-shoulders`, `abcd-pattern`,
    `triangle-pattern`, `three-drives-pattern`,
    `elliott-impulse-wave`, `elliott-correction-wave`,
    `elliott-triangle-wave`, `elliott-double-combo`,
    `elliott-triple-combo`.
  - `other` (19): 10 `fib-*` + 4 `gann-*` + 3 cycles
    (`cyclic-lines`, `time-cycles`, `sine-line`) + 2 containers
    (`group`, `frame`).

  Conformance scenarios: 61 per-kind + 12 task bundles +
  `drawAll61` + `drawBudgetOverflow` + `drawUnsupportedKind` = **76**.
  Docs: 61 auto-generated `docs/primitives/draw/<kind>.md` pages +
  1 hand-written `index.md`.

  Variant collapses pinned in Task 1 (carried forward unchanged):

  - `pitchfork.variant: "standard" | "schiff" | "modified-schiff" | "inside"`
    collapses the 4 invinite pitchfork tools.
  - `line.{extendLeft, extendRight}` collapses the `ray` /
    `extended-line` tools.
  - `cypherPattern` ships as a `defineDrawing`-only kind (no
    standalone interactive tool).

  Compiler: `callsiteIdInjection` recognises every `draw.*` callable
  via the widened 154-entry `STATEFUL_PRIMITIVES`;
  `statefulCallInLoop` flags `draw.*` in unbounded loops with the
  existing `stateful-call-inside-loop` error.

  Bench thresholds (re-verified post-Phase-3 on Apple-silicon):

  - `pushDrawing.bench.test.ts` — 10 000 line drawings under 2 000ms
    wall-clock (`ceil(median × 3)` per §22.10; no drift across
    Tasks 4–18 — the budget/validate path is independent of
    per-kind canvas renderers). `pnpm bench:ci` median ~180ms.
  - The Phase-2 ta / ringBuffer / seriesView / onBarClose /
    plot / hline bench thresholds were bumped from the
    `200/250/300/400/500/600ms` solo-run pins to a uniform `1500ms`
    (3000ms for plot + hline) to absorb the parallel-worker
    scheduling overhead during workspace `pnpm test` (665 test
    files in parallel). Solo `pnpm bench:ci` medians remain in the
    10–200ms range — well under both old and new thresholds — so
    this is a noise-floor adjustment, not a perf-regression
    accommodation.

  `apiVersion: 1` script header unchanged; Phase 3 is additive at
  runtime.

- b0d296b: Phase 3 Task 20 — `defineDrawing` constructor + interactive-tool
  conformance scenarios.

  - **core** — new `defineDrawing(opts)` constructor + `DefineDrawingOpts`
    type. Mirrors `defineIndicator` structurally; the only differences are
    `manifest.kind === "drawing"` and `manifest.capabilities ===
["drawings"]`. The runtime treats indicator and drawing scripts
    identically at the per-bar level — the discriminator is a host-side
    hint the editor uses to distinguish drawing scripts in the
    script-picker UI (PLAN.md §4.1). The constructor accepts the same
    Phase-3 `maxDrawings?: DrawingCounts` per-bucket cap propagation as
    `defineIndicator`.
  - **compiler** — `analysis/structuralChecks.ts` widens its recognised
    constructor set to include `defineDrawing` and maps it to
    `manifest.kind === "drawing"`. `StructuralCheckResult.kind` widens
    to `"indicator" | "drawing" | "alert"` (matches `buildManifest`'s
    existing type). The in-memory ambient `.d.ts` shim in `program.ts`
    declares `DefineDrawingOpts` + `defineDrawing` so a `defineDrawing`
    script type-checks under the host-machine-independent program.
    `extractCapabilities` now takes a `kind` parameter and seeds with
    `"drawings"` (or `"alerts"`) when the script is a `defineDrawing`
    (or `defineAlert`) — previously every script unconditionally
    declared `"indicators"`. Error messages on
    `missing-default-export` / `api-version-mismatch` now mention all
    three constructor names.
  - **conformance** — three new bundled scenarios, all default-exporting
    through `defineDrawing`:

    - `DEFINE_DRAWING_BASIC_SCENARIO` — single `draw.fibRetracement(...)`
      emission on bar 0 through the new constructor. Verifies the
      constructor + compiler structural-check + capability extraction
      - runtime emit path end-to-end. Pinned `drawing-hash`:
        `eae59a6d44c41ef3b08b20728a9ee723bf0a0cd62e1107c9ab19aa4efa27b488`.
    - `DRAW_INTERACTIVE_UPDATE_SCENARIO` — captures the
      `draw.horizontalLine(bar.close)` handle in module-level state
      on bar 0, then calls `handle.update({ price: bar.close })` on
      every subsequent bar across the 10 000-bar goldenBars stream.
      Pins handle-id stability + the full emission sequence (1
      `create` + 9 999 `update`s). Pinned `drawing-hash`:
      `797d159809da91f43fc32149998da9e5d71b011134564d42c3e5da2027c22e6f`.
    - `DRAW_HANDLE_REMOVE_SCENARIO` — creates a `draw.text(...)` on
      bar 0, calls `handle.remove()` on bar 100 (= time
      `1_708_640_000_000`; goldenBars are 1-day intervals). Pinned
      `drawing-hash` captures both the `op: "create"` and
      `op: "remove"` emissions; `drawing-budget-exceeded` absent.
      Pinned `drawing-hash`:
      `b742d39fe5d03cb211b57bc26f0d24a89f9db966c481279368cc083932394a09`.

    Scenario cardinality after Task 20: \*\*61 per-kind + 12 task-bundles

    - 3 (smoke + budget + capability) + 3 (Task-20 constructor) = 79\*\*,
      of which 78 are in `ALL_SCENARIOS` (the Task-19
      `DRAW_UNSUPPORTED_KIND_SCENARIO` remains opt-in only).

  ### Divergences from spec (`tasks/phase-3-drawing-parity/20-define-drawing.md`)

  1. **Spec § Requirements §1 sketches a `compute` shape and a separate
     `onCreate(ctx, anchors)` / `onUpdate(handle, ctx, anchors)`
     callback pair.** Per the team-lead brief + the spec's own example
     (lines 53–58, which uses `compute`), Phase 3 ships the
     `compute`-based shape only. The `onCreate`/`onUpdate` interactive-
     editor callbacks are Phase 4 sugar layered on top of the
     constructor (PLAN.md §10.1.1).
  2. **Spec § Requirements §4.2 asks for a new `manifest-kind`
     `ScenarioAssertion` variant.** Deferred — adding a new assertion
     variant is a runner-API change out of scope here. The
     `manifest.kind === "drawing"` contract is covered by unit tests:
     `defineDrawing.test.ts` (constructor side), `manifest.test.ts`
     (compiler-builder side), `structuralChecks.test.ts` (AST-walk
     side), and `compile.test.ts` (end-to-end compile of a
     `defineDrawing` script). Flag as a Phase-4 follow-up if
     downstream adapter authors accumulate similar capability/manifest
     assertions.
  3. **Spec § Files lists `defineDrawing.types.test.ts`.** Not created.
     The sibling `defineIndicator.ts` / `defineAlert.ts` don't have
     `.types.test.ts` files; the typings are covered through the
     runtime tests' `script.manifest.kind` access.
  4. **Spec § Requirements §6 mentions a "manifest extractor test in
     compiler package".** Covered by widening
     `structuralChecks.test.ts` (which captures `kind` from the
     AST) + extending `manifest.test.ts` + adding the `compile.test.ts`
     end-to-end row. No new file needed.
  5. **`extractCapabilities` widening was not in the original task
     list** — but is required so a `defineDrawing` script emits
     `capabilities: ["drawings"]` instead of `["indicators"]`. The
     change is backwards-compatible (the new `kind` parameter
     defaults to `"indicator"`) and pinned with new test rows.

- b0d296b: Phase-3 Task 5 — first per-port task. Lands the 6 line-family drawing
  kinds (`line`, `horizontalLine`, `horizontalRay`, `verticalLine`,
  `crossLine`, `trendAngle`) per PLAN.md §10 and §22.10.

  `@invinite-org/chartlang-runtime` ships 6 new `draw.<kind>(...)` emit
  functions under `src/emit/draw/lines/` plus the `DRAW_NAMESPACE` swap
  seam at `src/emit/draw/namespace.ts` — the namespace re-exports core's
  throwing-stub Proxy for the 55 kinds that haven't shipped yet and
  routes the 6 line kinds through their runtime impls. Each impl uses
  the dual-overload pattern (`(a, b, opts?)` script-facing throw +
  `(slotId, a, b, opts?)` compiler-injected) mirroring `plot` / `alert`.
  Returns a `DrawingHandle` per PLAN.md §10.3; subsequent in-bar
  `update(patch)` calls merge into the slot's state and re-emit the
  full payload.

  `@invinite-org/chartlang-compiler` widens the core ambient shim
  (`program.ts`) with `WorldPoint`, `LineDrawStyle`, `DrawingHandle`,
  `DrawNamespace` declarations + `export const draw: DrawNamespace` so
  the callsite-id transformer recognises `draw.<kind>(...)` calls and
  injects the slot id (entries already shipped in `STATEFUL_PRIMITIVES`
  via Task 1).

  `chartlang-example-canvas2d-adapter` ships 6 new renderers under
  `src/render/draw/` — `line.ts`, `horizontalLine.ts`,
  `horizontalRay.ts`, `verticalLine.ts`, `crossLine.ts`,
  `trendAngle.ts` — plus the shared `extendLineSegment` helper that
  projects a segment to the viewport edges (consumed by `line` when its
  `extendLeft`/`extendRight` flags are set, and by `horizontalRay`
  which always extends right). The `drawingDispatch` switch arms for
  the 6 line kinds flip from no-op stubs to real-impl calls; the
  exhaustive `satisfies never` default and `op: "remove"` short-circuit
  are unaffected. The `trendAngle` renderer additionally draws a small
  arc + angle text at the `from` anchor, mirroring the invinite tool's
  `paintTrendAngleArc`.

  `@invinite-org/chartlang-conformance` lands 7 new bundled scenarios:
  6 per-kind (`DRAW_LINE_SCENARIO`, `DRAW_HORIZONTAL_LINE_SCENARIO`,
  `DRAW_HORIZONTAL_RAY_SCENARIO`, `DRAW_VERTICAL_LINE_SCENARIO`,
  `DRAW_CROSS_LINE_SCENARIO`, `DRAW_TREND_ANGLE_SCENARIO`) plus one
  category bundle (`DRAW_LINES_AND_RAYS_SCENARIO`). Each uses
  `inlineSource` and pins one `drawing-hash` assertion + asserts
  `unsupported-drawing-kind` and `drawing-budget-exceeded` are absent.
  The `TEST_CAPABILITIES` bag in the conformance test suite widens
  `drawings` to `capabilities.allLineDrawings()` and lifts the `lines`
  bucket budget from `0` to `100` so the new scenarios reach
  `pushDrawing`'s happy path. All 7 scenarios pass against the
  canvas2d default adapter (which already declared
  `drawings: capabilities.allPhase3Drawings()` via Task 4).

  All Phase-1 / Phase-2 / Tasks-1–4 gates remain green. 100% coverage
  maintained across `runtime`, `canvas2d-adapter`, and `conformance`.

- Phase 4 - Editor + Inputs + Timeframes + Tier-1 Pine parity.
  Adds: input._ builders, state._ / state.tick.\* slots,
  barstate / syminfo / timeframe views, request.security typed
  surface (NaN fallback), defineIndicator overrides,
  Capabilities triad (intervals / multiTimeframe / subPanes /
  symInfoFields / maxDrawingsPerScript / alertConditions / logs),
  language-service hover registry + LSP-style API, CodeMirror 6
  editor shell + /react sub-export, Inputs UI ViewModel + React
  form. See tasks/phase-4-editor-tier1/README.md.
- Extract `input.*` descriptors into compiled script manifests and add input declaration diagnostics.
- Add compiler extraction for static `request.security` intervals and `requiresIntervals`, and register `request.security` for callsite slot ids.

### Patch Changes

- 3f3ce38: Phase-1 walking-skeleton: ship the conformance suite
  (`@invinite-org/chartlang-conformance`). The package now exports
  `runConformanceSuite(adapter, opts?)`, three pinned Phase-1
  scenarios (`EMA_CROSS_SCENARIO`, `BOLLINGER_BANDS_SCENARIO`,
  `RSI_DIVERGENCE_SCENARIO` + the `PHASE_1_SCENARIOS` aggregate), the
  deterministic 10 000-bar `goldenBars.json` fixture (Mulberry32 seed
  `0xC0DE`, four 2 500-bar regimes), and the
  `generateGoldenBars` / `serialiseGoldenBars` / `writeGoldenBars` /
  `GOLDEN_BARS_PATH` helpers. Closes the Phase-0
  `scripts/run-conformance.ts` short-circuit: `pnpm conformance` now
  runs the three scenarios end-to-end through the compiler + runtime
  against `examples/canvas2d-adapter`'s default export and prints
  `conformance: 3 scenarios passed, 0 failures.`.

  The `RSI_DIVERGENCE_SCENARIO` re-pins `alert-count` from `0` to
  `433` and adds two `alert-message-contains` assertions
  (`"RSI dropped below 70"`, `"RSI rose above 30"`). The original
  scenario codified a dead-code path in
  `examples/scripts/rsi-divergence-alert.chart.ts` — the `rsi.current
&gt; 70 && ta.crossunder(rsi, 70).current` guard was a
  contradiction (crossunder requires the current value to be below
  the threshold) so the overbought / oversold exit alerts could
  never fire. The script now uses `ta.crossunder(rsi, 70).current`
  and `ta.crossover(rsi, 30).current` directly.

  `@invinite-org/chartlang-compiler` rides along with a one-line patch
  to `transformers/resolveCallee.ts`: the callsite-id transformer now
  also rewrites stateful calls on parameters destructured from
  `compute({ ta, plot, alert, hline })` (the previous code only
  matched top-level imports, so the example scripts under
  `examples/scripts/` would have thrown the "outside an active script
  step" sentinel at runtime). Discovered while wiring the conformance
  runner against the on-disk example scripts; covered by new
  `resolveCallee.test.ts` cases.

- 38fb475: Phase-2 Task 5 — cross-functional `ta.*` primitives + `STATEFUL_PRIMITIVES`
  shape evolution.

  Ships six new Pine-canonical `ta.*` primitives under
  `packages/runtime/src/ta/`:

  - `ta.nz(value, replacement?)` — stateless NaN-replacement.
  - `ta.highest(source, length)` — rolling max (monotone deque + window
    recompute).
  - `ta.lowest(source, length)` — rolling min (mirror of `highest`).
  - `ta.change(source, opts)` — first-difference `source[0] − source[length]`.
  - `ta.valuewhen(condition, source, occurrence)` — source value at the
    n-th most recent matching bar.
  - `ta.barssince(condition)` — bars since the last `condition === true`.

  Each primitive ships the §22.10 set: impl + unit + property + golden +
  bench pair + conformance scenario (using the Phase-2 `inlineSource`
  extension from Task 1) + auto-generated `docs/primitives/ta/<id>.md`.

  `STATEFUL_PRIMITIVES` widens from `ReadonlySet<string>` to
  `ReadonlySet<{ name: string; slot: boolean }>` so `ta.nz` (the only
  stateless cross-functional primitive) can opt out of compiler slot-id
  injection. Phase-1 entries flip to `slot: true`; `ta.nz` is the only
  `slot: false` entry; the set cardinality grows from 12 → 18. The shape
  update cascades through every compiler consumer
  (`packages/compiler/src/api.ts`, `program.ts`,
  `analysis/statefulCallInLoop.ts`, `transformers/callsiteIdInjection.ts`,
  and their tests). The `statefulCallInLoop` analysis still flags every
  entry inside a loop body — `slot: false` primitives are forbidden in
  loops by Pine-parity convention.

  `TA_REGISTRY` cardinality grows from 9 → 15. `RuntimeTaNamespace`
  mirrors core's `TaNamespace` 1:1 with the standard `slotId` first-arg
  on every method except `nz` (which carries the script-author signature
  verbatim).

  Compiler change is `patch`-level — the public API surface is
  unchanged; only the internal `STATEFUL_PRIMITIVES` parameter shape
  widens. Core/runtime/conformance bump `minor` for the new exports and
  the new scenarios.

- 38fb475: Phase-2 Task 7 — MA ports (`ta.dema`, `ta.tema`, `ta.kama`, `ta.alma`).

  Adds four chained / adaptive moving averages on top of the Phase-1
  EMA primitive + the Task-6 MA backbone. DEMA / TEMA compose EMA
  sub-slots through `TA_REGISTRY` (`${slotId}/ema1` / `/ema2` / `/ema3`);
  KAMA is Kaufman's adaptive MA with an efficiency-ratio-driven
  smoothing constant; ALMA is the Arnaud Legoux MA with a precomputed
  Gaussian weight kernel.

  Each primitive ships the §22.10 set (impl + four test layers +
  conformance scenario + auto-generated docs page). ALMA's `offset`
  opt is the Gaussian-centre position in `[0, 1]` (default `0.85`) —
  distinct from the universal bar-shift, which lives on `opts.barShift`
  for ALMA only.

  Compiler patch: the ambient shim mirrors the four new
  `TaNamespace` methods + opt bags.

- 38fb475: Phase-2 Task 8 — final §9.2 MA ports (`ta.lsma`, `ta.mcginley`, `ta.maRibbon`).

  Closes out the §9.2 moving-averages list. `ta.lsma` is the linear-
  regression value at the trailing window (reuses Task-4's
  `linearRegression` helper for the property-test reference);
  `ta.mcginley` is the McGinley Dynamic recurrence with NaN-correct
  zero-anchor handling; `ta.maRibbon` is a fan of K MAs at different
  lengths, dispatched per-bar through `TA_REGISTRY`'s registered MA
  primitives (`sma` / `ema` / `wma` / `smma`) via sub-slot ids
  `${slotId}/ma_<length>`.

  `MaRibbonResult` is a dynamic-keyed record `{ ma_<length>:
Series<number> }`. The exported `maRibbonOutputKeys(opts)` helper
  returns the ordered keys for stable iteration. `maRibbon` is
  registry-tagged as multi-output via `TA_REGISTRY_METADATA` with its
  default `primarySeriesKey: "ma_50"` + default visible keys
  `["ma_10", "ma_20", "ma_30", "ma_40", "ma_50"]` + `{ kind: "auto" }`
  y-domain — runtime metadata for legend chips and pane axes.

  Core also adds the `MaTypeNoVolume` string-literal union (parallel to
  the runtime's `lib/maTypes.ts` alias) so script authors can type the
  `maType` opt directly. Each primitive ships the §22.10 set (impl +
  four test layers + conformance scenario + auto-generated docs page).

  Compiler patch: the ambient shim mirrors the three new `TaNamespace`
  methods + opt bags + `MaTypeNoVolume` alias + `MaRibbonResult` type.

- 38fb475: Phase-2 Task 6 — MA ports (`ta.wma`, `ta.vwma`, `ta.hma`, `ta.smma`).

  Adds four moving-average primitives on top of the Task-3 chained-MA
  helpers. `ta.wma` is a linear-weighted MA over the trailing window;
  `ta.vwma` is the volume-weighted variant; `ta.smma` is Wilder's
  smoothed MA (α = 1/N); `ta.hma` is the Hull MA composed via three WMA
  sub-slots derived from the parent slot id (`${slotId}/half`,
  `${slotId}/full`, `${slotId}/final`).

  Each primitive ships the §22.10 set (impl + four test layers +
  conformance scenario + auto-generated docs page). The opts bags
  (`WmaOpts`, `VwmaOpts`, `HmaOpts`, `SmmaOpts`) carry the universal
  `offset` + `lineStyle` fields — typed surface only; the runtime
  wiring lands in Task 29's universal-offset backfill.

  Compiler patch: the ambient shim mirrors the four new
  `TaNamespace` methods + opt bags.

- 38fb475: Phase-2 Task 29 — Universal `opts.offset` backfill on Phase-1 primitives.

  Wires the universal `opts.offset` (PLAN.md §9.1) onto every Phase-1
  `ta.*` primitive: `sma`, `ema`, `stdev`, `bb`, `rsi`, `macd`, `atr`,
  `crossover`, `crossunder`. Positive `offset` shifts the returned
  series so `series.current` reads the value `offset` bars ago
  (matching `lib/applyOffset`'s `out[i] = values[i − offset]`
  semantics); negative `offset` reads into the future (NaN /
  undefined at the head). `offset === 0` is the strict identity
  fast path — returns the slot's cached un-shifted Series with the
  same reference as before this change (existing identity-pinned
  tests continue to pass).

  Surface expansion (core, minor):

  - `offset?: number` added to `SmaOpts`, `EmaOpts`, `StdevOpts`,
    `BbOpts`, `RsiOpts`, `MacdOpts`, `AtrOpts` (Phase-1 opts types
    that previously had no `offset` field).
  - New `CrossoverOpts` / `CrossunderOpts` types (the two cross
    primitives previously took no opts bag); `TaNamespace.crossover`
    / `crossunder` signatures gain an optional 3rd opts arg.
  - New `makeShiftedSeriesView` runtime helper next to
    `makeSeriesView` (in `packages/runtime/src/seriesView.ts`,
    re-exported from the runtime barrel) — wraps a `RingBufferLike<T>`
    in a Proxy that adjusts `at(n)` reads by `offset`.

  Composite primitives (`bb`, `macd`) shift all outputs in lockstep
  under a single `offset` value, returning a frozen result record
  cached per offset on the slot. Sub-slot outputs (sma's middle,
  ema's signal) are accessed through their captured ring-buffer
  reference so the parent primitive doesn't re-enter the sub-slot's
  compute on the shifted-view lookup.

  Compiler patch: the ambient shim in `packages/compiler/src/program.ts`
  mirrors the core type changes (new `offset?` fields + new
  `CrossoverOpts` / `CrossunderOpts` types + extended `TaNamespace`
  signatures).

  Goldens, bench thresholds, and conformance scenarios are
  unchanged — `offset === 0` is the default and exercises the
  existing code paths. New per-primitive `<id>.test.ts` and
  `<id>.property.test.ts` cases cover positive, negative, zero, and
  identity-cache behaviour for offset.

- 38fb475: Phase 2 quality-pass fixes (cross-cutting).

  - `@invinite-org/chartlang-core`: new `STATEFUL_PRIMITIVES_BY_NAME`
    export — a `ReadonlyMap<string, StatefulPrimitiveEntry>` derived
    from the same canonical entry list as `STATEFUL_PRIMITIVES`. Lets
    the compiler look up entries by callee name in O(1) instead of an
    O(n) scan over the 93-entry set on every visited call site.
  - `@invinite-org/chartlang-compiler`: `callsiteIdInjection` and
    `statefulCallInLoop` now consume `STATEFUL_PRIMITIVES_BY_NAME`
    via a `statefulByName: ReadonlyMap<string, StatefulPrimitiveEntry>`
    parameter (was `statefulSet: ReadonlySet<StatefulPrimitiveEntry>`).
    Internal-only API change — neither pass is publicly exported from
    `packages/compiler/src/index.ts`. The per-pass `hasName` /
    `findEntry` helpers are dropped.
  - `@invinite-org/chartlang-runtime`: `ta/lib/maTypes.ts` re-exports
    `MaTypeNoVolume` from `@invinite-org/chartlang-core` instead of
    re-declaring it locally — keeps the two definitions from drifting
    when a 6th MA kind is added. `MaType` (which adds `"vwma"`) stays
    local since core has no equivalent. `__fixtures__/syntheticBars.ts`
    and `nanTick.test.ts`'s inline `Bar` literals now carry the
    `hl2` / `hlc3` / `ohlc4` / `hlcc4` fields the Phase-2 `Bar`
    extension made required (the per-package tsconfig had been hiding
    the typecheck miss).

  Also: `examples/canvas2d-adapter` — extracted the duplicated
  `dashPattern(LineStyle)` from `render/area.ts` + `render/horizontalLine.ts`
  into `render/lineDash.ts`, re-exported from `render/index.ts`. No
  behaviour change.

- 38fb475: Phase-2 Task 27 — S/R ports: `ta.zigZag`, `ta.pivotsHighLow`,
  `ta.pivotsStandard`, and `ta.volatilityStop` (closes §9.2's S/R
  list).

  Ships four new S/R `ta.*` primitives under
  `packages/runtime/src/ta/`:

  - `ta.zigZag(opts?)` — streaming swing-pivot detector. Walks the
    close series tracking a running candidate pivot; confirms a new
    pivot when the price has reversed by ≥ `deviation %` AND `depth`
    bars have elapsed. Returns `{ value, direction }` where `value`
    carries the most-recently-confirmed pivot price (held constant
    between confirmations, NaN before the first) and `direction` is
    `+1` / `-1` / NaN. Defaults `deviation = 5`, `depth = 10`.
    Streaming adaptation of invinite's batch ZigZag — invinite's
    linear-interpolation rendering between pivots isn't representable
    in the append-only `Series` model, so the output is the closest
    surface (a "trailing reference level").
  - `ta.pivotsHighLow(opts?)` — centred-window swing-pivot detector
    with asymmetric `(leftLength, rightLength)` confirmation windows.
    Returns `{ high, low }` (price-level series — `bar.high(centre)`
    or `bar.low(centre)` when a pivot confirms, NaN otherwise).
    Mirrors invinite's tie-break: strict-greater on the left window,
    geq on the right (matches Pine `ta.pivothigh`). Defaults
    `leftLength = rightLength = 4` (9-bar window).
  - `ta.pivotsStandard(opts?)` — classical daily pivot-point levels
    (P, R1..R3, S1..S3) derived from the previous UTC-day's HLC.
    Returns seven `Series<number>` (`{ pp, r1, s1, r2, s2, r3, s3 }`).
    Four formula systems: `"classic"` (default), `"fibonacci"`,
    `"camarilla"`, `"woodie"`. UTC-day boundary detection via
    `Math.floor(bar.time / 86_400_000)`. R4 / R5 / S4 / S5 levels
    (Camarilla's full table) and DeMark / Traditional systems
    intentionally defer per the Phase-2 README "Deferred / Follow-Up
    Work" footnote.
  - `ta.volatilityStop(opts?)` — PSAR-like trend-following stop
    driven by ATR. Composes Phase-1 `ta.atr` at sub-slot
    `${slotId}/atr`. Returns `{ value, direction }` (`+1` uptrend →
    stop is BELOW price; `-1` downtrend → stop ABOVE). Defaults
    `length = 20`, `multiplier = 2`. Source hard-coded to `bar.close`
    (Pine `ta.vstop` convention; invinite's `source` field is
    omitted, a `source` opt could land in a follow-up).

  All four primitives suspend their recurrence state on NaN OHLC so
  the next finite bar resumes from the prior state. `replaceHead`
  correctness is asserted via append-vs-replaceHead property tests
  over `arbBar` fixtures — ZigZag and Volatility Stop snapshot their
  state-machine state at the start of each bar BEFORE the close-side
  recurrence advances so a final tick replays from the seed
  (mirrors Task 25's PSAR / Supertrend pattern).

  Each primitive ships the §22.10 set: impl + unit + property +
  golden + bench pair + conformance scenario (using the Phase-2
  `inlineSource` extension from Task 1) + auto-generated
  `docs/primitives/ta/<id>.md`. `TA_REGISTRY_METADATA` carries the
  multi-output / y-domain hints (all four use `yDomain: { kind:
"auto" }`).

  Core adds `ZigZagOpts`, `ZigZagResult`, `PivotsHighLowOpts`,
  `PivotsHighLowResult`, `PivotsStandardOpts`,
  `PivotsStandardResult`, `PivotsStandardSystem`,
  `VolatilityStopOpts`, and `VolatilityStopResult` exports + four
  `TaNamespace` methods. `STATEFUL_PRIMITIVES` grows by 4 (all
  `slot: true`). `TA_REGISTRY` mirrors with the leading
  `slotId: string` on each method.

  Compiler patch: the ambient shim mirrors the four new methods +
  nine new types.

- Add Phase 4 script override fields to core define options and compiler manifests.
- Updated dependencies [3f3ce38]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [b0d296b]
- Updated dependencies [b0d296b]
- Updated dependencies [b0d296b]
- Updated dependencies [b0d296b]
- Updated dependencies [b0d296b]
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @invinite-org/chartlang-core@0.4.0
