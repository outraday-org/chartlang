# @invinite-org/chartlang-adapter-kit

## 0.4.0

### Minor Changes

- 3f3ce38: Replace the Phase-0 placeholder with the Phase-1 adapter contract:
  `Adapter` / `Capabilities` / `CandleEvent` types and the §7.3 emission
  shapes, capability builders (`capabilities.line()` / `.allLines()` /
  `.alerts(...)` / `.union(...)`), `defineAdapter` factory, hand-rolled
  `validateEmission` (no `zod` / `valibot` dependency) covering every
  Phase-1 emission and meta walker, `decodeDrawing` Phase-1 stub,
  `mockCandleSource` for test playback, and `PassThroughAdapter` /
  `BufferingAdapter` base classes for runtime + conformance fixtures.
- 38fb475: Phase 2 — `0.2` full indicator parity.

  - 81 new `ta.*` primitives (6 cross-functional + 75 §9.2 ports);
    `TA_REGISTRY` cardinality 9 -> 90; `STATEFUL_PRIMITIVES`
    cardinality 12 -> 93.
  - 5 new chained-MA helpers + 5 new stats/volatility helpers in
    `packages/runtime/src/ta/lib/`.
  - 6 new `PlotKind`s (histogram, bars, area, filled-band, label,
    marker) + canvas2d renderers + `validateEmission` arms.
  - `Bar` extended with `hl2` / `hlc3` / `ohlc4` / `hlcc4` derived
    source fields — runtime already pre-computes on `BarView`.
  - `Scenario` extended with `inlineSource?: string` so Phase-2
    scenarios stay self-contained without bloating
    `examples/scripts/`.
  - `STATEFUL_PRIMITIVES` shape widened from `ReadonlySet<string>`
    to `ReadonlySet<{ name: string; slot: boolean }>` to support
    `ta.nz` (the only stateless `ta.*`).
  - Universal `opts.offset` honoured on every `ta.*` primitive
    (Phase-1 backfill in Task 29).
  - `chartlang docs` subcommand generates
    `docs/primitives/ta/<id>.md` per primitive.
  - `PHASE_2_INDICATORS` + `PHASE_5_DEFERRED` inventories exported
    from `@invinite-org/chartlang-conformance` and pinned by
    `phase2Coverage.test.ts` (Task 30).
  - 100% coverage maintained across every published package.
  - `apiVersion: 1` script header unchanged; Phase 2 is additive
    at runtime.

- 38fb475: Phase-2 Task 1 — three foundational widenings every subsequent
  Phase-2 port depends on:

  1. **`PlotKind` expansion (3 → 9).** Adds `histogram`, `bars`,
     `area`, `filled-band`, `label`, `marker` per PLAN.md §7.3. The
     `PlotStyle` discriminated union in
     `@invinite-org/chartlang-adapter-kit` extends in lockstep; the
     `validateEmission` switch grows matching arms with per-kind
     payload rules; the `capabilities` builder gains `histogram()` /
     `bars()` / `area()` / `filledBand()` / `label()` / `marker()` /
     `allPhase2Plots()`. The canvas2d reference adapter ships six new
     pure-on-`RenderCtx` renderers (`render/histogram.ts`, `bars.ts`,
     `area.ts`, `filledBand.ts`, `label.ts`, `marker.ts`) and flips
     `CANVAS2D_CAPABILITIES.plots` to `capabilities.allPhase2Plots()`
     (9 kinds). `RenderCtx` + `MockCanvas2DContext` extend with
     `fillText`, `globalAlpha`, `font`, `textAlign`, `textBaseline`.

  2. **`Bar` derived sources.** Extends the script-facing `Bar`
     (`packages/core/src/types.ts`) with the four pre-computed derived
     sources `hl2` / `hlc3` / `ohlc4` / `hlcc4`. The runtime's
     `BarView` (`packages/runtime/src/streamState.ts`) already
     populates these on every close — Phase 2 surfaces them so authors
     can write `ta.cci(bar.hlc3, 20)` like Pine. No runtime change.

  3. **`Scenario.inlineSource`.** Extends the conformance `Scenario`
     type (`packages/conformance/src/runConformanceSuite.ts`) with an
     optional `inlineSource?: string` field that is mutually exclusive
     with the existing `scriptPath?: string`. `runConformanceSuite`
     writes the inline source to the existing `.cache/` tmp file and
     compiles + imports it exactly like the `scriptPath` branch, with
     a virtual `<inline:${id}>.chart.ts` `sourcePath` so callsite-id
     injection produces stable, pinnable slot ids. Phase-2 ports use
     this to carry their `defineIndicator` source inline rather than
     spawning 80+ files in `examples/scripts/`.

  The new `PLOT_KIND_COVERAGE_SCENARIO` exercises the `inlineSource`
  path + the wider capability surface end-to-end (one inline
  `plot(bar.close)` + `hline(50)` script; asserts no
  `unsupported-plot-kind` and no `malformed-emission` diagnostics
  fire). Per-port Phase-2 tasks (Tasks 21+) each add their own
  scenario asserting the specific new kind's drained emissions once
  the runtime acquires the matching emission path.

  No runtime / host-worker source-level changes in this task —
  `BarView` already carries the four derived fields, and the
  `PlotKind` expansion is additive at every consumer.

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

- b0d296b: Phase 3 Task 10 — Channels (`trendChannel` / `flatTopBottom` /
  `disjointChannel` / `regressionTrend`).

  - **adapter-kit** — 4 new per-kind validators (`validateTrendChannelState`,
    `validateFlatTopBottomState`, `validateDisjointChannelState`,
    `validateRegressionTrendState`) + 1 file-local style helper
    (`validateRegressionTrendOpts` with the
    `close|open|high|low|hl2|hlc3|ohlc4|hlcc4` source whitelist). The
    `regression-trend` validator enforces `anchors[0].time <
anchors[1].time` and `stdevMultiplier >= 0`.
  - **runtime** — 4 new emit functions under
    `packages/runtime/src/emit/draw/channels/` wired into `DRAW_NAMESPACE`.
    `regressionTrend` carries the 4-arg form
    `(slotId, a: WorldPoint, b: WorldPoint, opts?)`. The Phase-2
    `linearRegression` + `LinearRegressionFrame` helper graduates to the
    public runtime surface so consumer adapters can compute the OLS fit
    without duplicating math.
  - **canvas2d-adapter** — 4 new renderers + dispatch wiring. The
    `regression-trend` renderer strokes a placeholder anchor-to-anchor
    line; the actual OLS fit + σ bands require bar-buffer access not
    exposed by the current `Viewport` (see
    `tasks/phase-3-drawing-parity/10-channels.plan.md` §3). `trendChannel`
    / `flatTopBottom` / `disjointChannel` are stroke-only (no fill polygon
    between rails — see plan §5).
  - **conformance** — 5 new scenarios (4 per-kind + 1
    `drawChannelsAll` bundle) with pinned `drawing-hash` assertions.

  See `tasks/phase-3-drawing-parity/10-channels.plan.md` for the full
  audit + divergence flags.

- b0d296b: Phase 3 Task 11 — Fibonacci A (`fibRetracement` / `fibTrendExtension`
  / `fibChannel` / `fibTimeZone` / `fibWedge`).

  - **core** — `DrawNamespace` flattened: the four sub-namespace types
    (`FibSubNamespace`, `GannSubNamespace`, `ElliottSubNamespace`,
    `PatternSubNamespace`) are removed; every kind now lives as a flat
    method directly on `DrawNamespace` matching the canonical
    `STATEFUL_PRIMITIVES` names (`draw.fibRetracement(...)`,
    `draw.gannBox(...)`, `draw.elliottImpulseWave(...)`,
    `draw.xabcdPattern(...)`, etc.). The throwing-stub `draw` Proxy
    drops the sub-namespace branch. Script authors use the flat
    Pine/invinite-parity surface; the compiler resolves callsites
    through its existing 2-segment property-access path. The 30
    not-yet-ported method signatures (Tasks 12–18 fib-B / gann /
    pitchfork / pattern / elliott / cycle / container kinds) are
    declared as flat stubs so Tasks 12–18 only need to extend the
    runtime `KIND_IMPLS` map. **BREAKING** for any consumer that
    referenced `draw.fib.retracement(...)` or one of the four
    sub-namespace types — none currently exist outside Phase-3 work.
  - **adapter-kit** — 5 new per-kind validators
    (`validateFibRetracementState`, `validateFibTrendExtensionState`,
    `validateFibChannelState`, `validateFibTimeZoneState`,
    `validateFibWedgeState`) + 1 file-local style helper
    (`validateFibOpts`) covering FibOpts (`levels` finite-array,
    `showLabels` / `color` / `extendLeft` / `extendRight`).
  - **runtime** — 5 new emit functions under
    `packages/runtime/src/emit/draw/fibA/` wired into `DRAW_NAMESPACE`
    as flat methods. `fibRetracement` / `fibTimeZone` use the 4-arg
    form `(slotId, a, b, opts?)`; the other 3 use the 3-arg
    `(slotId, anchors, opts?)` form. No new sub-namespace wiring.
  - **canvas2d-adapter** — 5 new renderers reusing Task-4's
    `FIB_LEVELS` + `formatLevel` and Task-5's `extendLineSegment` for
    the `fib-retracement` viewport extension. Default colour
    `"#facc15"` (warm yellow) per invinite's fib-tool palette.
  - **conformance** — 6 new scenarios (5 per-kind + 1
    `drawFibA` bundle) with pinned `drawing-hash` assertions.
    Conformance + scenarios test-capability fixtures grow `other`
    bucket from 0 to 100 and add the 5 fib-A kebab kinds.

  Divergences flagged in `tasks/phase-3-drawing-parity/11-fibonacci-a.plan.md`:

  - `fib-time-zone` uses the canonical ratio array (`FIB_LEVELS`),
    NOT the integer Fibonacci sequence; `fibSequence.ts` helper is
    NOT created (Task-1 reshape follow-up).
  - `fib-wedge` rays are drawn with a fixed length
    `max(pxWidth, pxHeight) * 2` rather than via a directional
    `extendLineSegment` variant.
  - Per-kind property / golden test files deferred to the pragmatic
    1-file-per-emit + 1-file-per-renderer set, mirroring Tasks 5–10.

  See `tasks/phase-3-drawing-parity/11-fibonacci-a.plan.md` for the
  full audit + divergence list.

- b0d296b: Phase 3 Task 12 — Fibonacci B (`fibSpeedFan` / `fibSpeedArcs` /
  `fibSpiral` / `fibCircles` / `fibTrendTime`).

  - **adapter-kit** — 5 new per-kind validators
    (`validateFibSpeedFanState`, `validateFibSpeedArcsState`,
    `validateFibSpiralState`, `validateFibCirclesState`,
    `validateFibTrendTimeState`), reusing Task-11's `validateFibOpts`
    style helper. The permissive-default test fixture moves from
    `fib-speed-fan` to `gann-box` (Task 13's first kind, still
    unported).
  - **runtime** — 5 new emit functions under
    `packages/runtime/src/emit/draw/fibB/` wired into the
    `DRAW_NAMESPACE` `KIND_IMPLS` map as flat methods. Four use the
    4-arg form `(slotId, a, b, opts?)`; `fibTrendTime` uses the 3-arg
    `(slotId, anchors, opts?)`. Fall-through-stub fixture in
    `namespace.test.ts` / `primitives.test.ts` /
    `buildComputeContext.test.ts` moves from `fibSpeedFan` to
    `gannBox`.
  - **canvas2d-adapter** — 5 new renderers reusing Task-4's
    `FIB_LEVELS` + `formatLevel`. `fibSpiral` additionally reuses
    `sampleCubic` for the chained quarter-Bezier approximation of the
    golden spiral. Default colour `"#facc15"` per invinite's fib-tool
    palette.
  - **conformance** — 5 new per-kind scenarios + 1 bundle
    (`drawFibAll.scenario.ts` covering all 10 fib kinds, superseding
    Task 11's `drawFibA.scenario.ts` which is deleted). Conformance +
    scenarios test-capability fixtures switch from the explicit
    fib-A kebab list to `capabilities.allFibDrawings()` (covers all
    10 kinds). All 6 hashes pinned against the deterministic-run
    actuals.

  Divergences flagged in `tasks/phase-3-drawing-parity/12-fibonacci-b.plan.md`:

  - `fibSpiral` is clockwise-only — invinite's `counterClockwise`
    flag is deferred (Task-1 reshape follow-up; landed `FibSpiralState`
    - `FibOpts` don't carry the field).
  - `fibSpeedArcs` is full-circle only — invinite's half-disk variant
    is deferred (Phase-3-deferred UX nuance).
  - `fibCircles` + `fibTrendTime` use the ratio array (`FIB_LEVELS`),
    NOT the integer Fibonacci sequence. Same precedent as Task-11's
    `fib-time-zone`.
  - `gen-docs` regeneration for the 5 new kinds deferred to Task 21
    (the existing `chartlang docs` command only walks `ta.*`; the
    `draw.*` walker extension is an explicit Task-21 deliverable).
  - Per-kind property / golden test files deferred to the pragmatic
    1-file-per-emit + 1-file-per-renderer set, mirroring Tasks 5–11.

  See `tasks/phase-3-drawing-parity/12-fibonacci-b.plan.md` for the
  full audit + divergence list.

- b0d296b: Phase 3 Task 13 — Gann (`gannBox` / `gannSquareFixed` / `gannSquare` /
  `gannFan`).

  - **adapter-kit** — 4 new per-kind validators
    (`validateGannBoxState`, `validateGannSquareFixedState`,
    `validateGannSquareState`, `validateGannFanState`), reusing
    Task-5's `validateLineDrawStyle` style helper. The
    permissive-default test fixture moves from `gann-box` to
    `pitchfork` (Task 14's first kind, still unported).
  - **runtime** — 4 new emit functions under
    `packages/runtime/src/emit/draw/gann/` wired into the
    `DRAW_NAMESPACE` `KIND_IMPLS` map as flat methods. Three use the
    4-arg form `(slotId, a, b, opts?)`; `gannSquareFixed` uses the
    3-arg `(slotId, anchor, opts?)`. Fall-through-stub fixture in
    `namespace.test.ts` / `primitives.test.ts` /
    `buildComputeContext.test.ts` moves from `gannBox` to `pitchfork`.
  - **canvas2d-adapter** — 4 new renderers + a shared `gannLevels.ts`
    helper exporting `GANN_LEVELS` (`[0, 0.25, 0.5, 0.75, 1]`),
    `GANN_FAN_RATIOS` (9-entry tuple covering 1×1, 1×2, …, 8×1),
    `GANN_FAN_LABELS`, and `formatGannRatio`. Default colour
    `"#a855f7"` (purple/violet, mirroring invinite's gann-tool
    palette).
  - **conformance** — 4 new per-kind scenarios + 1 bundle
    (`drawGannAll.scenario.ts` covering all 4 gann kinds).
    Conformance + scenarios test-capability fixtures widen
    `drawings` with `capabilities.allGannDrawings()`. All 5 hashes
    pinned against the deterministic-run actuals.

  Divergences flagged in `tasks/phase-3-drawing-parity/13-gann.plan.md`:

  - `gannBox.levels` custom override deferred — landed `GannBoxState`
    carries only `style: LineDrawStyle`. Renderer uses the shared
    `GANN_LEVELS` constant only (Task-1 reshape follow-up).
  - `gannSquareFixed.sizePrice` custom override deferred — landed
    `GannSquareFixedState` carries only `anchor + style`. Renderer
    uses a fixed `80px` side (Task-1 reshape follow-up).
  - `gannSquare.ratio` custom override deferred — landed
    `GannSquareState` carries only `anchors + style`. Renderer uses
    canvas-space `max(|dx|, |dy|)` (1×1 default, Task-1 reshape
    follow-up).
  - `gannFan.showLabels` flag deferred — `LineDrawStyle` has no
    `showLabels` field. Phase-3 pins unlabeled rays (Task-1 reshape
    follow-up).
  - `gen-docs` regeneration for the 4 new kinds deferred to Task 21
    (the existing `chartlang docs` command only walks `ta.*`; the
    `draw.*` walker extension is an explicit Task-21 deliverable).
  - Per-kind property / golden test files deferred to the pragmatic
    1-file-per-emit + 1-file-per-renderer set, mirroring Tasks 5–12.

  See `tasks/phase-3-drawing-parity/13-gann.plan.md` for the full
  audit + divergence list.

- b0d296b: Phase 3 Task 14 — Pitchforks (`pitchfork` / `pitchfan`). The
  `pitchfork` kind collapses the four invinite tools (`standard` /
  `schiff` / `modifiedSchiff` / `inside`) into one kind with a
  `variant` discriminator per PLAN.md §3.1.

  - **adapter-kit** — 2 new per-kind validators
    (`validatePitchforkState`, `validatePitchfanState`), reusing
    Task-2's `validateAnchorTriple` + Task-5's `validateLineDrawStyle`
    helpers. `validatePitchforkState` also pins the 4-entry variant
    enum (`standard | schiff | modifiedSchiff | inside`). The
    permissive-default test fixture moves from `pitchfork` to
    `xabcd-pattern` (Task 15's first kind, still unported).
  - **runtime** — 2 new emit functions under
    `packages/runtime/src/emit/draw/pitchforks/` wired into the
    `DRAW_NAMESPACE` `KIND_IMPLS` map as flat methods. Both use the
    3-arg form `(slotId, anchors, opts?)`. `pitchfork` accepts
    `opts: LineDrawStyle & { variant? }` — the impl destructures
    `variant` (defaulting to `"standard"`), strips it from the
    style payload, and builds the `PitchforkState`. Fall-through-stub
    fixture in `namespace.test.ts` / `primitives.test.ts` /
    `buildComputeContext.test.ts` moves from `pitchfork` to
    `xabcdPattern`.
  - **canvas2d-adapter** — 2 new renderers + a shared
    `pitchforkGeom.ts` helper exporting `medianOriginFor(variant, a,
b, c)` and `medianTargetFor(variant, a, b, c)` (per-variant
    median-rail endpoints in canvas space). Default colour
    `"#ec4899"` (pink/magenta, mirroring invinite's pitchfork-tool
    palette family). The pitchfork renderer emits 3 strokes per
    emission (median + 2 parallel handles through `b` and `c`); the
    pitchfan renderer emits 3 rays from `a` through `b`, `mid(b, c)`,
    `c`.
  - **conformance** — 2 new per-kind scenarios + 1 bundle
    (`drawPitchforksAll.scenario.ts` covering 4 pitchfork variants +
    1 pitchfan = 5 emissions). Conformance + scenarios + index
    test-capability fixtures widen `drawings` with
    `capabilities.allPitchforkDrawings()`. All 3 hashes pinned
    against the deterministic-run actuals.

  Divergences flagged in
  `tasks/phase-3-drawing-parity/14-pitchforks.plan.md`:

  - `extendLeft` / `extendRight` flags from invinite's
    `PitchforkDrawing` not on landed `PitchforkState`. Phase-3 pins
    the default extend-forward behaviour for each rail (Task-1
    reshape follow-up).
  - Per-instance `levels` array not on landed state. Phase-3 renders
    the median + 2 parallel-handle pattern only — no per-level
    offsets (Task-1 reshape follow-up).
  - `medianColor` / `medianLineStyle` / `medianStrokeWidthPx` not on
    landed state. Phase-3 paints the median with the same
    `LineDrawStyle` as the handles (Task-1 reshape follow-up).
  - `gen-docs` regeneration for the 2 new kinds deferred to Task 21
    (the existing `chartlang docs` command only walks `ta.*`; the
    `draw.*` walker extension is an explicit Task-21 deliverable).
  - Per-kind property / golden test files deferred to the pragmatic
    1-file-per-emit + 1-file-per-renderer set, mirroring Tasks 5–13.

  See `tasks/phase-3-drawing-parity/14-pitchforks.plan.md` for the
  full audit + divergence list.

- b0d296b: Phase 3 Task 15 — Harmonic Patterns (`xabcdPattern` / `cypherPattern`
  / `headAndShoulders` / `abcdPattern` / `trianglePattern` /
  `threeDrivesPattern`). All 6 kinds map to the `polylines` bucket and
  ship as flat methods (`draw.<kind>(...)`) per the Task-11 Option-C
  decision.

  - **adapter-kit** — 6 new per-kind validators
    (`validateXabcdPatternState`, `validateCypherPatternState`,
    `validateHeadAndShouldersState`, `validateAbcdPatternState`,
    `validateTrianglePatternState`,
    `validateThreeDrivesPatternState`) plus a new
    `validateAnchorHept` helper covering the 7-anchor
    `three-drives-pattern` shape. All 6 validators reuse Task-5's
    `validateLineDrawStyle` and Task-2's per-anchor-arity helpers.
    The permissive-default test fixture moves from `xabcd-pattern`
    → `elliott-impulse-wave` (Task 16's first kind, still unported).
  - **runtime** — 6 new emit functions under
    `packages/runtime/src/emit/draw/patterns/` wired into the
    `DRAW_NAMESPACE` `KIND_IMPLS` map as flat methods. Each uses the
    3-arg form `(slotId, anchors, opts?)` with the dual-overload
    pattern. Fall-through-stub fixture in `namespace.test.ts` /
    `primitives.test.ts` / `buildComputeContext.test.ts` moves from
    `xabcdPattern` to `elliottImpulseWave`.
  - **canvas2d-adapter** — 6 new renderers plus a shared
    `namedPolyline.ts` helper exporting `renderNamedPolyline(ctx,
points, labels, style)` — strokes an open polyline through the
    pre-projected canvas-space points and fills one text label
    above each anchor (textAlign `center` + textBaseline `bottom`,
    6 px above the anchor). Default colour `#f59e0b` (amber/orange,
    matching invinite's pattern-tool palette family).
    `headAndShoulders` adds a neckline stroke between the two
    trough anchors (`anchors[1]` → `anchors[3]`), totalling 2
    strokes per emission; the other 5 kinds emit 1 polyline stroke
    - N point labels.
  - **conformance** — 6 new per-kind scenarios + 1 bundle
    (`drawPatternsAll.scenario.ts` covering all 6 kinds = 6
    emissions). Conformance + scenarios + index test-capability
    fixtures widen `drawings` with
    `capabilities.allPatternDrawings()`. All 7 hashes pinned
    against the deterministic-run actuals.

  **Provenance carve-out — `cypherPattern`.** Per the team-lead
  brief + PLAN.md §3.1, `cypher-pattern` has no standalone invinite
  tool — only the y-doc-bridge type. The runtime emit
  (`packages/runtime/src/emit/draw/patterns/cypherPattern.ts`) and
  the canvas2d renderer
  (`examples/canvas2d-adapter/src/render/draw/cypherPattern.ts`)
  both cite **only** `invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts`
  in their relicense headers (no `*-tool.ts` line). The UI surface
  for cypher lives in `defineDrawing` (Task 20).

  Divergences flagged in
  `tasks/phase-3-drawing-parity/15-patterns.plan.md`:

  - **`headAndShoulders` is 5-anchor on the landed state** (Task 1's
    `HeadAndShouldersState.anchors: AnchorQuint`), not the 7-anchor
    invinite shape (`start, leftShoulder, leftTrough, head,
rightTrough, rightShoulder, end`). The renderer treats the 5
    anchors as `[LS, LL, H, RL, RS]` and strokes a neckline between
    the two trough anchors only (no start/end projection). Flagged
    as a Task-1 reshape follow-up.
  - **`trianglePattern` is 3-anchor on the landed state**
    (`TrianglePatternState.anchors: AnchorTriple`), not the 4-anchor
    invinite shape (`a, b, c, d`). The renderer treats the 3 anchors
    as `[apex, baseHigh, baseLow]` matching the landed type's
    `@anchors` annotation. Flagged as a Task-1 reshape follow-up.
    Distinct from `draw.triangle` (Task 6), a solid-shape primitive
    with `ShapeStyle` — `draw.trianglePattern` is a harmonic-pattern
    outline with `LineDrawStyle`. JSDoc cross-references the
    distinction.
  - `gen-docs` regeneration for the 6 new kinds deferred to Task 21
    (the existing `chartlang docs` command only walks `ta.*`; the
    `draw.*` walker extension is an explicit Task-21 deliverable).
  - Per-kind property / golden test files deferred to the pragmatic
    1-file-per-emit + 1-file-per-renderer set, mirroring Tasks 5–14.

  See `tasks/phase-3-drawing-parity/15-patterns.plan.md` for the
  full audit + divergence list.

- b0d296b: Phase 3 Task 16 — Elliott Waves (`elliottImpulseWave` /
  `elliottCorrectionWave` / `elliottTriangleWave` / `elliottDoubleCombo`
  / `elliottTripleCombo`). All 5 kinds map to the `polylines` bucket
  and ship as flat methods (`draw.<kind>(...)`) per the Task-11
  Option-C decision.

  - **adapter-kit** — 5 new per-kind validators
    (`validateElliottImpulseWaveState`,
    `validateElliottCorrectionWaveState`,
    `validateElliottTriangleWaveState`,
    `validateElliottDoubleComboState`,
    `validateElliottTripleComboState`) plus a new
    `validateOptionalLabels(v, path, expectedCount)` helper that
    validates the optional script-author `state.labels` override
    (when present: array of strings whose length exactly matches the
    per-kind anchor count). All 5 validators reuse Task-5's
    `validateLineDrawStyle` and Task-2/15's
    `validateAnchorTriple` / `validateAnchorQuint` /
    `validateAnchorHept`. The permissive-default test fixture moves
    from `elliott-impulse-wave` → `cyclic-lines` (Task 17's first
    kind, still unported).
  - **runtime** — 5 new emit functions under
    `packages/runtime/src/emit/draw/elliott/` wired into the
    `DRAW_NAMESPACE` `KIND_IMPLS` map as flat methods. Each uses the
    3-arg form `(slotId, anchors, opts?)` with the dual-overload
    pattern. The runtime widens `opts` to
    `LineDrawStyle & { labels?: ReadonlyArray<string> }` — the impl
    destructures `labels` from `opts`, strips it from the style
    payload, and stores it on `state.labels` only when present
    (preserving the optional field's `undefined` state when omitted
    so emission hashes stay stable). Fall-through-stub fixture in
    `namespace.test.ts` / `primitives.test.ts` /
    `buildComputeContext.test.ts` moves from `elliottImpulseWave` to
    `cyclicLines`.
  - **canvas2d-adapter** — 5 new renderers reusing Task-15's
    `renderNamedPolyline` helper. Default colour `#14b8a6` (teal —
    free palette slot distinct from blue/yellow/purple/pink/amber).
    Each renderer honours the optional `state.labels` override when
    present and its length matches the anchor count (defensive
    fallback to the per-kind default `LABELS` constant). Per-kind
    default labels: impulse `["1","2","3","4","5"]`, correction
    `["A","B","C"]`, triangle `["a","b","c","d","e"]`, double-combo
    `["S","W","x1","X","x2","Yi","Y"]`, triple-combo
    `["S","W","X1","Y","X2","Zi","Z"]`. Dispatch test's describe
    label bumps from "Task-16+ stubs" to "Task-17+ stubs".
  - **conformance** — 5 new per-kind scenarios + 1 bundle
    (`drawElliottAll.scenario.ts` covering all 5 kinds = 5
    emissions). Conformance + scenarios + index test-capability
    fixtures widen `drawings` with `capabilities.allElliottDrawings()`.
    All 6 hashes pinned against the deterministic-run actuals.

  Divergences flagged in
  `tasks/phase-3-drawing-parity/16-elliott.plan.md`:

  - **`WaveDegree` enum + label-decoration helper NOT on landed state**
    (Task 1's `Elliott*State` shapes carry no `degree` field — they
    carry an optional `labels?: ReadonlyArray<string>` field instead,
    letting the script author override the per-kind default labels
    directly). The 9-level `WaveDegree` enum + the
    `elliottLabels.ts` decoration helper are dropped from Phase 3.
    Flagged as a Task-1 reshape follow-up.
  - **`elliottImpulseWave` is 5-anchor on the landed state** (Task 1's
    `ElliottImpulseWaveState.anchors: AnchorQuint`), not the 6-anchor
    invinite shape. The renderer treats the 5 anchors as the wave1End
    → wave5End pivots and strokes 4 connecting legs. Same precedent
    for `elliottCorrectionWave` (landed 3-anchor vs invinite 4),
    `elliottTriangleWave` (landed 5-anchor vs invinite 6), and
    `elliottTripleCombo` (landed 7-anchor vs invinite 10). All
    flagged as Task-1 reshape follow-ups.
  - `gen-docs` regeneration for the 5 new kinds deferred to Task 21
    (the existing `chartlang docs` command only walks `ta.*`; the
    `draw.*` walker extension is an explicit Task-21 deliverable).
  - Per-kind property / golden test files deferred to the pragmatic
    1-file-per-emit + 1-file-per-renderer set, mirroring Tasks 5–15.

  See `tasks/phase-3-drawing-parity/16-elliott.plan.md` for the full
  audit + divergence list.

- b0d296b: Phase 3 Task 17 — Cycles (`cyclicLines` / `timeCycles` / `sineLine`).
  All 3 kinds map to the `other` bucket and ship as flat methods
  (`draw.<kind>(a, b, opts?)`) per the Task-11 Option-C decision.

  - **adapter-kit** — 3 new per-kind validators
    (`validateCyclicLinesState`, `validateTimeCyclesState`,
    `validateSineLineState`). All 3 reuse Task-2's `validateAnchorPair`
    - Task-5's `validateLineDrawStyle`; no new helpers needed (cycle
      states carry no `labels` field, so Task-16's
      `validateOptionalLabels` is not consumed). The permissive-default
      test fixture moves from `cyclic-lines` → `group` (Task 18's first
      kind, still unported).
  - **runtime** — 3 new emit functions under
    `packages/runtime/src/emit/draw/cycles/` wired into the
    `DRAW_NAMESPACE` `KIND_IMPLS` map as flat methods. Each uses the
    4-arg dual-overload form `(slotId, a, b, opts?)` mirroring `line`
    (the script-author surface is the 3-arg `(a, b, opts?)`; the
    compiler injects the leading slot id). State is assembled as
    `anchors: [a, b]`. Fall-through-stub fixture in
    `namespace.test.ts` / `primitives.test.ts` /
    `buildComputeContext.test.ts` moves from `cyclicLines` to `group`.
  - **canvas2d-adapter** — 3 new renderers reusing Task-4's
    `worldPointToCanvas` + Phase-1 `dashPattern`. Default colour
    `#0ea5e9` (sky blue — free palette slot distinct from
    blue/yellow/purple/pink/amber/teal/green/red used by prior port
    tasks). Per-kind geometry:

    - `cyclicLines` — repeated full-height vertical strokes at
      `fromX + n * periodPx` for n ∈ [0, viewport+overscan/periodPx],
      capped at 256 iterations. Skips silently on degenerate period.
    - `timeCycles` — concentric upper-half arcs centred at the
      midpoint of `(from, to)` on the `from.price` baseline, radius =
      `|toX − fromX| / 2`. Arcs tile across the viewport at multiples
      of the diameter (64 per side). Skips silently on degenerate
      diameter.
    - `sineLine` — sampled sinusoidal polyline. Half-period =
      `|toX − fromX|` (full period doubled). Baseline = midpoint of
      `(fromY, toY)`. Amplitude = `|fromY − toY| / 2`. 32 samples per
      full period; wave starts at the `from` extreme (peak vs trough
      flipped by `fromPx.y < toPx.y` — mirrors invinite's
      `extremeIsPeak` flag). Skips silently on degenerate half-period.

    Dispatch test's describe labels bump from "Tasks 5–15 shipped" to
    "Tasks 5–17 shipped" and "Task-17+ stubs" to "Task-18+ stubs".

  - **conformance** — 3 new per-kind scenarios + 1 bundle
    (`drawCyclesAll.scenario.ts` covering all 3 kinds = 3 emissions).
    Conformance + scenarios + index test-capability fixtures widen
    `drawings` with `capabilities.allCycleDrawings()`. All 4 hashes
    pinned against the deterministic-run actuals:
    `drawCyclicLines` = `975166fe…aae16`,
    `drawTimeCycles` = `1bdaca36…d88c0`,
    `drawSineLine` = `9f88b689…3ba8`,
    `drawCyclesAll` = `ef46754f…cc80b`.

  Divergences flagged in
  `tasks/phase-3-drawing-parity/17-cycles.plan.md`:

  - **`SineLineState.period: number` field NOT on landed state**
    (Task 1's `SineLineState` carries only `anchors` + `style` —
    the renderer derives the half-period from `|to.time − from.time|`,
    matching invinite's tool source). The explicit `period: number`
    field is dropped from Phase 3; flagged as a Task-1 reshape
    follow-up.
  - **`TimeCyclesState.style.fill` / `fillAlpha` NOT on landed state**
    (Task 1's `TimeCyclesState` uses `LineDrawStyle`, not
    `ShapeStyle`). The renderer strokes the arcs only — invinite's
    tool source DOES fill the half-circles. Flagged as a Task-1
    reshape follow-up.
  - **`to.time > from.time` reject NOT enforced** — Phase-3 renderer
    no-ops silently on degenerate input, matching every other Phase-3
    drawing port (gann / fib / elliott all silently no-op on
    collapsed anchors). The validator accepts reversed anchors per
    `validateAnchorPair`'s finite-only contract.
  - `gen-docs` regeneration for the 3 new kinds deferred to Task 21
    (the existing `chartlang docs` command only walks `ta.*`; the
    `draw.*` walker extension is an explicit Task-21 deliverable).
  - Per-kind property / golden test files deferred to the pragmatic
    1-file-per-emit + 1-file-per-renderer set, mirroring Tasks 5–16.

  See `tasks/phase-3-drawing-parity/17-cycles.plan.md` for the full
  audit + divergence list.

- b0d296b: Phase 3 Task 18 — Containers (`group` / `frame`). The FINAL per-port
  task: after this lands all 61 `DrawingKind`s have real validator /
  emit / renderer / dispatch arms. Both kinds map to the `other`
  bucket and ship as flat methods (`draw.group(childHandleIds)` /
  `draw.frame(a, b, opts?)`) per the Task-11 Option-C decision.

  - **adapter-kit** — 2 new per-kind validators (`validateGroupState`,
    `validateFrameState`) + 2 tiny shared helpers
    (`validateOptionalChildHandleIds`, `validateFrameOpts`). `group`
    pins `childHandleIds.length ≤ 100`; `frame` reuses Task-2's
    `validateAnchorPair`, accepts degenerate anchors (silent no-op at
    the renderer per the rest of Phase-3's degenerate-input
    precedent). The permissive-default test fixture
    (`validateEmission.test.ts:1516`) flips from
    `permissively-accepts` to a rejecting `validateGroupState`
    assertion + a new gate-only test that asserts unknown kinds drop
    with `unsupported-drawing-kind` upstream. After Task 18 every
    `DrawingKind` has a real validator arm — the
    `default: return { ok: true };` arm in `validateStateByKind` is
    removed; TS's exhaustiveness check now catches a future
    `DrawingKind` addition without a validator.
  - **runtime** — 2 new emit functions under
    `packages/runtime/src/emit/draw/containers/` wired into the
    `DRAW_NAMESPACE` `KIND_IMPLS` map as flat methods. `group` is a
    2-arg dual-overload `(slotId, childHandleIds)`; `frame` is a 4-arg
    dual-overload `(slotId, a, b, opts?)` mirroring `line`. After Task
    18 `IMPL_KIND_NAMES.size === 61`; the Proxy's else-branch
    fall-through to core's throwing-stub is dead code on the
    `DrawNamespace` type surface — kept as defence-in-depth for
    property access outside that type. The pre-Task-18
    "still-stubbed" assertions in `namespace.test.ts` /
    `primitives.test.ts` / `buildComputeContext.test.ts` are replaced
    with a positive cardinality sweep that asserts every
    `DrawingKind` resolves to a real runtime impl that throws the
    in-step-only sentinel (NOT the core stub sentinel).
  - **canvas2d-adapter** — 1 real renderer (`renderFrame`) + 1 pure
    no-op renderer (`renderGroup`). `renderFrame` strokes a closed
    4-corner rectangle defaulting to slate `#64748b`, optionally
    paints a `fillRect` background when `style.bgColor` is set, and
    optionally paints a `fillText` label inset 6 px from the top-left
    when `style.label` is set. Degenerate anchors (zero width or zero
    height in canvas space) silently no-op. `renderGroup` is a pure
    no-op for Phase 3 — the visible bounding-box envelope around
    grouped drawings is a Phase-4 follow-up tied to
    `Viewport.drawingsById` plumbing (Viewport currently exposes only
    `xMin/xMax/yMin/yMax/pxWidth/pxHeight`). `drawingDispatch`'s
    `// Containers (Task 18)` arms flip from `return;` no-ops to
    `return renderGroup(...)` / `return renderFrame(...)`. The
    `drawingDispatch.test.ts` describe labels bump:
    `Task-18+ stubs` → `'group' no-op + exhaustiveness`;
    `Tasks 5–17 shipped` → `Tasks 5–18 shipped`.
  - **conformance** — 2 new per-kind scenarios (`drawGroup`,
    `drawFrame`) + 1 bundle (`drawContainersAll`, 2 emissions).
    Pinned `drawing-hash` assertions for each:
    - `draw-group`:
      `6e32e387543ef421d1e53c1c15612cc32a814c85c2d969ad86d9f47b8d0359a2`
    - `draw-frame`:
      `4b54e0b6e75ad40904e0f70ac5b34067afa6c1237d43060823889f04b86d900b`
    - `draw-containers-all`:
      `e6ba183dfc04145a5126e6ea75a4cb7117694adc13eea84853239c68810e91fe`
      `TEST_CAPABILITIES.drawings` widens with
      `...capBuilders.allContainerDrawings()`; the `PHASE_1_SCENARIOS`
      `toEqual` array (in `scenarios.test.ts` and `index.test.ts`)
      appends the 3 new scenarios under
      `// Phase 3 Task 18 — Containers.`.

  ### Divergences from spec (`tasks/phase-3-drawing-parity/18-containers.md`)

  1. **Spec § Runtime Notes says `draw.group(children:
ReadonlyArray<DrawingHandle>)` accepts handle objects.** Landed
     core surface takes `ReadonlyArray<string>` (handle ids) directly
     — the runtime impl uses the landed shape so the wire payload is
     1:1 with what the script passes. Documented in `draw.group`'s
     JSDoc with the canonical `draw.group([a.id, b.id])` pattern.
  2. **Spec § Renderer Notes says `group` renders a dashed bounding
     box derived from children's `view.drawingsById.get(childId).state`
     extrema.** Landed `Viewport` exposes no `drawingsById` field;
     adding it is a foundation-level Viewport change beyond a per-port
     task. Phase 3 ships `renderGroup` as a pure no-op (children
     render themselves per `GroupState`'s metadata contract);
     bounding-box envelope deferred to Phase 4.
  3. **Spec § Kinds Landed says `group.style: { lineWidth?; color? }`
     for the boundary box.** Landed `GroupState` has no `style` field
     (only `childHandleIds` + optional `meta`). Use the landed shape;
     the boundary-box style lands with the Phase-4 renderer rework.
  4. **Spec § Tests says degenerate `frame` anchors are a warning
     diagnostic.** Landed `validateAnchorPair` only enforces finite
     `time`/`price`; degenerate frames pass validation and the
     renderer silently no-ops on `width === 0 || height === 0`. This
     matches the rest of Phase 3's "no-op on degenerate input"
     precedent (gann/fib/elliott/cycles).
  5. **Per-kind property tests skipped** — same Tasks 5–17 precedent.
     The per-kind validator describe arms cover happy + wrong-shape
     per kind; the `childHandleIds.length ≤ 100` cap is exercised
     directly in the group describe block.

  ### Open / deferred

  - `GroupState` boundary-box style + `view.drawingsById` plumbing for
    the visible group envelope land in Phase 4 (Divergence §2 + §3).
  - `gen-docs` regeneration for `docs/primitives/draw/{group,frame}.md`
    defers to Task 21 (same precedent as Tasks 11–17 — the
    draw-namespace docs walker is Task 21's deliverable).
  - Workspace-wide gates (`pnpm typecheck`, `pnpm test` at the root)
    defer to Task 22's phase closeout. Per-package gates
    (adapter-kit / runtime / canvas2d / conformance) all green and
    100% coverage held.

- b0d296b: Phase-3 Task 2 — adapter-kit drawing surface.

  Widens `DrawingKind` from the Phase-1 `"line"` placeholder to the full
  61-entry kebab-case union (re-export of
  `@invinite-org/chartlang-core`'s `DrawingKind`). Narrows
  `DrawingEmission.state` from `unknown` to the typed `DrawingState`
  discriminated union. Adapter code that wrote `drawingKind: "line"`
  still compiles.

  Replaces the Phase-1 unconditional-fail `validateDrawingEmission` with
  a per-kind dispatch:

  - Unknown `drawingKind` → `unsupported-drawing-kind`.
  - Malformed payloads of a known kind → `malformed-emission`.
  - The 6 Lines/Rays validators land in this PR (`line`,
    `horizontal-line`, `horizontal-ray`, `vertical-line`,
    `cross-line`, `trend-angle`). Tasks 6–18 ADD their kind
    validators to the dispatch as ports land (per PLAN.md §22.10).
  - Validates `handleId` / `op` / `bar` / `time` /
    `state.kind === drawingKind` / `name`/`visible` meta for every
    kind.

  Replaces the Phase-1 `decodeDrawing` stub (always returned `null`)
  with the real implementation: returns the typed `DrawingState` for
  emissions that pass `validateEmission`, `null` otherwise.

  Extends `capabilities.*` with the Phase-3 builder set:

  - **61 per-kind builders** (`drawLine()`, `drawHorizontalLine()`,
    `drawFibRetracement()`, `drawElliottImpulseWave()`, …) — each
    returns a single-element `ReadonlySet<DrawingKind>` for opt-in
    precision.
  - **13 category-group builders** matching PLAN.md §10.2:
    `allLineDrawings()` (6), `allBoxDrawings()` (8),
    `allCurveDrawings()` (3), `allFreehandDrawings()` (3),
    `allAnnotationDrawings()` (5), `allChannelDrawings()` (4),
    `allFibDrawings()` (10), `allGannDrawings()` (4),
    `allPitchforkDrawings()` (2), `allPatternDrawings()` (6),
    `allElliottDrawings()` (5), `allCycleDrawings()` (3),
    `allContainerDrawings()` (2). The 13 categories are pairwise
    disjoint and sum to 61.
  - **`allPhase3Drawings()`** — the umbrella set of every kind.
    Adapters that support the full surface (canvas2d in Task 4)
    declare this as their `Capabilities.drawings`.

  Re-exports `bucketFor` + `KIND_BUCKET` + `type DrawingBucket` from
  core via the adapter-kit barrel. Adapter authors that want to
  pre-budget against the canonical kind → bucket map can import them
  directly from `@invinite-org/chartlang-adapter-kit`.

  No runtime behaviour change — the runtime still doesn't emit
  drawings. Phase-2 plot dispatch + meta walker + Phase-1 alert /
  diagnostic dispatches are unchanged. 100% coverage on
  `packages/adapter-kit` preserved.

- b0d296b: Phase-3 Task 6 — second per-port task. Lands the 4 straight-edged
  box-family drawing kinds (`rectangle`, `rotatedRectangle`, `triangle`,
  `polyline`) per PLAN.md §10 and §22.10. Behaviour ports from invinite
  commit `078f41fe2569d659d5aba726da8bcb5d3e2ced02`:
  `tools/rectangle-tool.ts`, `tools/rotated-rectangle-tool.ts`,
  `tools/triangle-tool.ts`, `tools/polyline-tool.ts`, and the matching
  `y-doc-bridge.ts` `DrawingMetadata` variants.

  `@invinite-org/chartlang-adapter-kit` adds per-kind state validators
  for the 4 box-A kinds — `validateRectangleState`,
  `validateRotatedRectangleState`, `validateTriangleState`,
  `validatePolylineState` — wired into the existing
  `validateStateByKind` dispatch. New file-local helpers
  `validateAnchorTriple` / `validateAnchorQuad` /
  `validateAnchorVariable(min, max)` / `validateShapeStyle` cover the
  anchor cardinalities and the `ShapeStyle` payload bag. `polyline`
  pins `3 ≤ anchors.length ≤ 20` (mirrors invinite's 20-point cap).
  Wire shape is stricter than before — payloads previously passing the
  permissive default arm now reject with `malformed-emission`.

  `@invinite-org/chartlang-runtime` ships 4 new `draw.<kind>(...)` emit
  functions under `src/emit/draw/boxes/` and extends the
  `DRAW_NAMESPACE` swap-seam at `src/emit/draw/namespace.ts`. Each impl
  uses the dual-overload pattern (`(...)` script-facing throw +
  `(slotId, ...)` compiler-injected) mirroring Task 5 / `plot` /
  `alert`. Returns a `DrawingHandle` per PLAN.md §10.3.

  `chartlang-example-canvas2d-adapter` ships 4 new renderers under
  `src/render/draw/` plus a shared `shapeStyle.ts` helper exporting
  `applyShapeStyle(ctx, style): AppliedShapeStyle` — sets stroke /
  lineWidth / dash and returns the resolved fill payload so the
  renderer can wrap `ctx.fill()` in a `globalAlpha` bracket. The
  `drawingDispatch` switch flips the 4 box-A arms from no-op stubs to
  real `renderXxx(ctx, e, view)` calls; exhaustiveness is preserved.
  Fill defaults to no-op, stroke defaults to `"#000000"`, lineWidth
  defaults to `1`. Rectangle is rendered as a closed 4-corner polygon
  (no `strokeRect` in the structural `RenderCtx`); rotatedRectangle
  walks the four world anchors directly (no canvas matrix ops);
  triangle walks 3 vertices; polyline auto-closes via `closePath()`.

  `@invinite-org/chartlang-conformance` ships 5 new scenarios under
  `src/scenarios/` — 4 per-kind (`drawRectangle`, `drawRotatedRectangle`,
  `drawTriangle`, `drawPolyline`) and 1 bundle (`drawBoxesA`). All five
  use `inlineSource` against the bundled 10 000-bar `goldenBars.json`
  fixture with anchor times pulled from `bars[0]` / `bars[500]` /
  `bars[1000]`. The `TEST_CAPABILITIES` bag in
  `runConformanceSuite.test.ts` + `scenarios.test.ts` widens to include
  `allBoxDrawings()` plus `boxes: 100` / `polylines: 100` budgets so
  the new scenarios reach `pushDrawing`'s happy path. The 5 new
  scenarios extend `PHASE_1_SCENARIOS` (now 96 entries) and the public
  re-export surface.

  No core edits — the `DrawingState` variants and `DrawNamespace`
  signatures Task 1 shipped are the canonical shape and Task 6 wires
  real impls to them.

  Deviations from spec, flagged for review:

  - Spec's `rotatedRectangle` "3 anchors (a, b, widthOffset)"
    ergonomics — Task 1's `AnchorQuad` (4 corners) is the persisted
    shape. Callers supply the 4 corners directly; the
    (a, b, widthOffset) reshape belongs to Task 20's `defineDrawing`
    if it remains a hard requirement.
  - Spec's `polyline` `ShapeStyle` + auto-close — Task 1 ships
    `LineDrawStyle` (no fill). Renderer strokes the closed path; fill
    would require widening the variant in a follow-up.
  - Per-kind §22.10 5-file test set deferred to pragmatic 1-file set
    (mirrors Task 5) — Task 3's `pushDrawing.*` and `handle.*` suite
    covers the underlying infra exhaustively.
  - `gen-docs` doc-page generation deferred to Task 21 (mirrors Task 5).

- b0d296b: Phase-3 Task 7 — third per-port task. Lands the 4 curved-edge /
  single-anchor box-family drawing kinds (`circle`, `ellipse`, `path`,
  `marker`) per PLAN.md §10 and §22.10. Behaviour ports from invinite
  commit `078f41fe2569d659d5aba726da8bcb5d3e2ced02`:
  `tools/circle-tool.ts`, `tools/ellipse-tool.ts`, `tools/path-tool.ts`,
  `tools/marker-tool.ts`, and the matching `y-doc-bridge.ts` variants.

  `@invinite-org/chartlang-adapter-kit` adds per-kind state validators
  for the 4 box-B kinds — `validateCircleState`, `validateEllipseState`,
  `validatePathState`, `validateMarkerState` — wired into the existing
  `validateStateByKind` dispatch. New file-local helpers
  `validatePathOpts` (LineDrawStyle + optional `closed: boolean`) and
  `validateTextOpts` (color / size / halign / valign / bgColor enums)
  cover the path / marker style bags. `path` pins
  `2 ≤ anchors.length ≤ 20` (mirrors invinite's 20-point cap and is
  narrower than `polyline`'s 3..20 because path supports a 2-point
  segment with optional caps). Wire shape is stricter than before —
  payloads previously passing the permissive default arm now reject
  with `malformed-emission`.

  `@invinite-org/chartlang-runtime` ships 4 new `draw.<kind>(...)` emit
  functions under `src/emit/draw/boxes/` and extends the
  `DRAW_NAMESPACE` swap-seam at `src/emit/draw/namespace.ts`. Each impl
  uses the dual-overload pattern Tasks 5 + 6 pinned. `draw.marker`
  splits its `opts` bag — top-level `text` / `value` land on
  `MarkerState` while the remaining `TextOpts` fields nest under
  `state.style`.

  `chartlang-example-canvas2d-adapter` ships 4 new renderers under
  `src/render/draw/`. `renderCircle` derives the radius in canvas-pixel
  space from `|edge - centre|` (matches invinite's circle-tool) and
  issues a single `ctx.arc(...)`. `renderEllipse` paints a 64-segment
  polyline approximation (Phase-1 `RenderCtx` exposes `arc(...)` but
  not `ellipse(...)` — a polyline keeps the renderer pure on the
  existing structural surface without widening it). `renderPath` paints
  an OPEN polyline (no `closePath` by default; `style.closed === true`
  toggles closure). `renderMarker` projects the anchor + paints
  `text` (when set) via `ctx.fillText` with `TextOpts`-derived font +
  alignment. Empty / undefined text is a pure no-op — icon-glyph
  painting belongs to Task 20's `defineDrawing` follow-up. The
  `drawingDispatch` switch flips the 4 box-B arms from no-op stubs to
  real `renderXxx(ctx, e, view)` calls; exhaustiveness is preserved.

  `@invinite-org/chartlang-conformance` ships 4 new per-kind scenarios
  under `src/scenarios/` (`drawCircle`, `drawEllipse`, `drawPath`,
  `drawMarker`). Per README §22.10 the Task-6 `drawBoxesA.scenario.ts`
  is REPLACED (deleted) by the wider `drawBoxesAll.scenario.ts`
  covering all 8 box kinds across Tasks 6 + 7 (rectangle /
  rotated-rectangle / triangle / polyline / circle / ellipse / path /
  marker). All five new scenarios use `inlineSource` against the
  bundled 10 000-bar `goldenBars.json` fixture with anchor times pulled
  from `bars[0]` / `bars[500]` / `bars[1000]`. The `TEST_CAPABILITIES`
  bag in `runConformanceSuite.test.ts` + `scenarios.test.ts` bumps
  `labels` budget from 0 to 100 to host the marker scenario (marker
  maps to the `labels` bucket). The 4 + 1 new scenarios extend
  `ALL_SCENARIOS` and the public re-export surface; `DRAW_BOXES_A_SCENARIO`
  is removed from the public surface (downstream consumers move to
  `DRAW_BOXES_ALL_SCENARIO`).

  No core edits — the `DrawingState` variants and `DrawNamespace`
  signatures Task 1 shipped are the canonical shape and Task 7 wires
  real impls to them.

  Deviations from spec, flagged for review:

  - `MarkerState` shape divergence — task spec's `markerKind` (`emoji` /
    `icon`) discriminator + `value: string` + `MAX_LENGTH = 32` + icon
    registry NOT implemented. Uses Task 1's landed
    `{ anchor, text?, value?, style: TextOpts }` shape (anchor not
    from/to pair; value is a number; no discriminator). Re-shaping
    belongs to a follow-up that widens core; mid-phase Task-1 reshapes
    cascade through the `DrawingState` union + adapter-kit decoder +
    Task-6 permissive-default tests.
  - `Ellipse` rendered as 64-segment polyline approximation because
    `RenderCtx` exposes `arc(...)` but not `ellipse(...)`. Widening
    the structural type would touch Phase-1's `RenderCtx`; the
    polyline path stays on the existing surface.
  - Per-kind §22.10 5-file test set deferred to pragmatic 1-file set
    (mirrors Tasks 5 + 6) — Task 3's `pushDrawing.*` and `handle.*`
    suite covers the underlying infra exhaustively.
  - `gen-docs` doc-page generation deferred to Task 21 (mirrors Tasks
    5 + 6).

- b0d296b: Phase-3 Task 8 — fourth per-port task. Lands the 6 curve + freehand
  drawing kinds (`arc`, `curve`, `doubleCurve`, `pen`, `highlighter`,
  `brush`) per PLAN.md §10 and §22.10. Behaviour ports from invinite
  commit `078f41fe2569d659d5aba726da8bcb5d3e2ced02`:
  `tools/arc-tool.ts`, `tools/curve-tool.ts`,
  `tools/double-curve-tool.ts`, `tools/pen-tool.ts`,
  `tools/highlighter-tool.ts`, `tools/brush-tool.ts`, and the matching
  `y-doc-bridge.ts` variants (`ArcDrawing`, `CurveDrawing`,
  `DoubleCurveDrawing`, `PenDrawing`, `HighlighterDrawing`,
  `BrushDrawing`). All 6 kinds map to the `polylines` bucket.

  `@invinite-org/chartlang-adapter-kit` adds per-kind state validators
  for the 6 curve + freehand kinds — `validateArcState`,
  `validateCurveState`, `validateDoubleCurveState`, `validatePenState`,
  `validateHighlighterState`, `validateBrushState` — wired into the
  existing `validateStateByKind` dispatch. Three new file-local helpers
  land alongside: `validateAnchorQuint` (5-tuple for `double-curve`),
  `validateHighlighterStyle` (required `color: string` + required
  `alpha ∈ [0, 1]`), and `validateBrushStyle` (required `stroke` + `fill`
  colour strings). Freehand kinds pin `2 ≤ anchors.length ≤ 500`
  (matches invinite's stroke cap; broader than the 2..20 path cap).
  Wire shape is stricter than before — payloads previously passing the
  permissive default arm now reject with `malformed-emission`.

  `@invinite-org/chartlang-runtime` ships 6 new `draw.<kind>(...)` emit
  functions under `src/emit/draw/curves/` and extends the
  `DRAW_NAMESPACE` swap-seam at `src/emit/draw/namespace.ts`. Each impl
  uses the dual-overload pattern Tasks 5–7 pinned. `draw.highlighter`
  and `draw.brush` differ from the other emit fns — their `opts`
  parameter is REQUIRED on the script-facing overload (no `?` because
  `HighlighterStyle` / `BrushStyle` carry required fields).

  `chartlang-example-canvas2d-adapter` ships 6 new renderers under
  `src/render/draw/`. The 3 curve renderers (`renderArc`, `renderCurve`,
  `renderDoubleCurve`) sample the curve via Task 4's `sampleQuadratic` /
  `sampleCubic` helpers at `CURVE_SAMPLES = 32` segments and stroke as a
  polyline — the structural `RenderCtx` exposes neither
  `quadraticCurveTo` nor `bezierCurveTo`, so this keeps the renderer
  pure on the Phase-1 surface (mirrors Task 7's `ellipse` 64-segment
  polyline approximation). `renderArc` derives the Bezier control point
  from `apex` via inverse-quadratic interpolation so the curve passes
  through `apex` at `t = 0.5`; `renderCurve` uses `anchors[1]` as the
  Bezier control directly (curve does NOT pass through control);
  `renderDoubleCurve` paints a single cubic from `anchors[0]` to
  `anchors[4]` with off-curve controls `anchors[1]` / `anchors[3]` (the
  middle stitch anchor `anchors[2]` is preserved in state but unused by
  the current render path — flagged for future split-rendering). The 3
  freehand renderers paint polylines: `renderPen` strokes open;
  `renderHighlighter` wraps the stroke in a `globalAlpha` set/reset
  bracket (default 6 px line width); `renderBrush` paints
  fill-then-stroke with `closePath` for a closed filled region. The
  `drawingDispatch` switch flips the 6 arms from no-op stubs to real
  `renderXxx(ctx, e, view)` calls; exhaustiveness is preserved.

  `@invinite-org/chartlang-conformance` ships 6 new per-kind scenarios
  under `src/scenarios/` (`drawArc`, `drawCurve`, `drawDoubleCurve`,
  `drawPen`, `drawHighlighter`, `drawBrush`) plus one bundle scenario
  `drawCurvesAndFreehandAll` that emits one drawing per curve + freehand
  kind on the first bar (per README §22.10 Task 8 collapses both
  categories into ONE bundle). All seven scenarios use `inlineSource`
  against the bundled 10 000-bar `goldenBars.json` fixture with anchor
  times pulled from `bars[0]` / `bars[500]` / `bars[1000]` (plus
  `bars[1500]` for the 4-point freehand strokes). The `TEST_CAPABILITIES`
  bags in `runConformanceSuite.test.ts` + `scenarios/scenarios.test.ts`
  extend the `drawings` set with `allCurveDrawings()` +
  `allFreehandDrawings()`; the existing `polylines: 100` bucket budget
  covers the bundle scenarios with headroom. `ALL_SCENARIOS` extends
  additively.

  No core edits — the `DrawingState` variants and `DrawNamespace`
  signatures Task 1 shipped are the canonical shape and Task 8 wires
  real impls to them.

  Deviations from spec, flagged for review:

  - `PressurePoint` type widening NOT applied — Task 1's `PenState`
    shape (`anchors: ReadonlyArray<WorldPoint>`) preserved per Tasks
    6/7 precedent of not reshaping Task-1 mid-phase. Adapter-level
    pressure-driven stroke-width variance is a follow-up concern.
  - `freehand.ts` smoothing helper NOT created. Per-renderer inline
    polyline loops suffice for Phase-3 deterministic `drawing-hash`
    assertions. If pressure-driven smoothing lands later, the helper
    can ship then.
  - `double-curve` middle anchor (`anchors[2]`, the stitch point) is
    preserved in state but currently unused by the renderer (single
    cubic from `anchors[0]` to `anchors[4]` with controls `[1]` / `[3]`).
    Future split-rendering can stitch two cubics through `mid`.
  - `arc` / `curve` / `doubleCurve` fill-path NOT rendered.
    `LineDrawStyle` has no fill fields; invinite's tools do support
    fill on these kinds. Widening to support fill is a Task-1 reshape
    and out of scope.
  - Bezier rendered as 32-segment polyline approximation because
    `RenderCtx` exposes `arc(...)` but not `quadraticCurveTo` /
    `bezierCurveTo`. Mirrors Task 7's `ellipse` 64-segment approach;
    widening would touch Phase-1 surface.
  - Per-kind §22.10 5-file test set deferred to pragmatic 1-file set
    (mirrors Tasks 5–7) — Task 3's `pushDrawing.*` and `handle.*`
    suite covers the underlying infra exhaustively.
  - `gen-docs` doc-page generation deferred to Task 21 (mirrors Tasks
    5–7).

- b0d296b: Phase-3 Task 9 — fifth per-port task. Lands the 5 annotation drawing
  kinds (`text`, `arrow`, `arrowMarker`, `arrowMarkUp`, `arrowMarkDown`)
  per PLAN.md §10 and §22.10. Behaviour ports from invinite commit
  `078f41fe2569d659d5aba726da8bcb5d3e2ced02`: `tools/text-tool.ts`,
  `tools/arrow-tool.ts`, `tools/arrow-marker-tool.ts`,
  `tools/arrow-mark-up-tool.ts`, `tools/arrow-mark-down-tool.ts`, and the
  matching `y-doc-bridge.ts` variants (`TextDrawing`, `ArrowDrawing`,
  `ArrowMarkerDrawing`, `ArrowMarkUpDrawing`, `ArrowMarkDownDrawing`).
  All 5 kinds map to the `labels` bucket.

  `@invinite-org/chartlang-adapter-kit` adds per-kind state validators
  for the 5 annotation kinds — `validateTextState`, `validateArrowState`,
  `validateArrowMarkerState`, `validateArrowMarkUpState`,
  `validateArrowMarkDownState` — wired into the existing
  `validateStateByKind` dispatch. Two new file-local style helpers land
  alongside: `validateArrowOpts` (`LineDrawStyle` + optional string
  `label`) and `validateArrowMarkerOpts` (optional `color` + optional
  `text`). `text.body` is validated through `walkMeta` (catches
  non-JsonValue payloads like bigint / function / symbol) and then
  pinned as a non-empty string with `TEXT_BODY_MAX_LENGTH = 256` (longer
  than the 128 cap on plot labels — annotation strings carry short
  rationales like "Inverse Head and Shoulders Confirmed"). Wire shape
  is stricter than before — payloads previously passing the permissive
  default arm now reject with `malformed-emission`.

  `@invinite-org/chartlang-runtime` ships 5 new `draw.<kind>(...)` emit
  functions under `src/emit/draw/annotations/` and extends the
  `DRAW_NAMESPACE` swap-seam at `src/emit/draw/namespace.ts`. Each impl
  uses the dual-overload pattern Tasks 5–8 pinned. `draw.text` is the
  first emit fn with three script-facing arguments (`anchor`, `body`,
  `opts?`); the compiler-injected form is `(slotId, anchor, body,
opts?)` and the impl signature carries four arguments.

  `chartlang-example-canvas2d-adapter` ships 5 new renderers under
  `src/render/draw/` plus three new shared helpers: `arrowhead.ts`
  (`drawArrowhead(ctx, from, to, size?)` — filled triangular arrowhead
  at `to` pointing along the shaft direction; used by `arrow` +
  `arrowMarker`), `chevron.ts` (`drawChevron(ctx, at, direction, color,
baseWidth?, height?)` — filled up/down triangle glyph; used by
  `arrowMarkUp` + `arrowMarkDown`), and `textStyle.ts` (`SIZE_TO_PX` /
  `HALIGN_TO_TEXTALIGN` / `VALIGN_TO_TEXTBASELINE` maps +
  `resolveTextOpts(opts)` helper that turns a `TextOpts` bag into the
  four canvas text-state values). The Task-7 `marker.ts` renderer is
  refactored to consume `textStyle.ts` for the same maps — its call
  sequence is preserved exactly so `marker.test.ts` continues to pass
  unchanged. Default colours follow invinite's paint-time defaults:
  `#3b82f6` (toolbar blue) for `arrowMarker`, `#22c55e` (green) for
  `arrowMarkUp`, `#ef4444` (red) for `arrowMarkDown`. The `drawingDispatch`
  switch flips the 5 arms from no-op stubs to real `renderXxx(ctx, e,
view)` calls; exhaustiveness is preserved.

  `@invinite-org/chartlang-conformance` ships 5 new per-kind scenarios
  under `src/scenarios/` (`drawText`, `drawArrow`, `drawArrowMarker`,
  `drawArrowMarkUp`, `drawArrowMarkDown`) plus one bundle scenario
  `drawAnnotationsAll` that emits one drawing per annotation kind on
  the first bar (per README §22.10 Task 9 collapses the category into
  ONE bundle). All six scenarios use `inlineSource` against the bundled
  10 000-bar `goldenBars.json` fixture with anchor times pulled from
  `bars[0]` / `bars[500]` / `bars[1000]`. The `TEST_CAPABILITIES` bags
  in `runConformanceSuite.test.ts` + `scenarios/scenarios.test.ts`
  extend the `drawings` set with `allAnnotationDrawings()`; the existing
  `labels: 100` bucket budget (added when Task 7's `marker` scenario
  landed) covers the bundle scenarios with headroom. `ALL_SCENARIOS`
  extends additively.

  No core edits — the `DrawingState` variants and `DrawNamespace`
  signatures Task 1 shipped are the canonical shape and Task 9 wires
  real impls to them.

  Deviations from spec, flagged for review:

  - `text.bgColor` background-rectangle paint NOT rendered. The
    structural `RenderCtx` exposes neither `measureText` nor a
    background-rect path; widening would touch the Phase-1 structural
    type. The `bgColor` field is preserved on the wire (validator
    accepts string) but the canvas2d renderer does not paint a
    background rect. Mirror Task 7's `marker` precedent.
  - `ArrowOpts.label` rotation NOT rendered. `RenderCtx` has no
    `rotate / translate / save / restore`. Label paints un-rotated at
    the shaft midpoint with `textAlign = "center"` /
    `textBaseline = "bottom"`. Pure on the Phase-1 surface.
  - `ArrowMarkerState` ↔ spec shape delta. Task 1's core landed
    `ArrowMarkerState` with single `anchor: WorldPoint`; the spec
    README §13 says `2 (from, to)`. Per Tasks 6/7's "don't reshape
    Task-1 mid-phase" precedent, Task 9 uses the single-anchor form
    and the renderer paints a self-contained glyph (dot + stub line +
    arrowhead + optional text) at the anchor — a "annotation lives
    here" marker that fits in ~24px. Reshape can ship in a follow-up.
  - `marker.ts` refactor crosses Task 7 boundary by ~5 lines to
    consume the new shared `textStyle.ts` helper. The call sequence is
    preserved exactly; `marker.test.ts` continues to pass without
    modifications.
  - Per-kind §22.10 5-file test set deferred to pragmatic 1-file set
    (mirrors Tasks 5–8) — Task 3's `pushDrawing.*` and `handle.*`
    suite covers the underlying infra exhaustively.
  - `gen-docs` doc-page generation deferred to Task 21 (mirrors Tasks
    5–8).

- Phase 4 - Editor + Inputs + Timeframes + Tier-1 Pine parity.
  Adds: input._ builders, state._ / state.tick.\* slots,
  barstate / syminfo / timeframe views, request.security typed
  surface (NaN fallback), defineIndicator overrides,
  Capabilities triad (intervals / multiTimeframe / subPanes /
  symInfoFields / maxDrawingsPerScript / alertConditions / logs),
  language-service hover registry + LSP-style API, CodeMirror 6
  editor shell + /react sub-export, Inputs UI ViewModel + React
  form. See tasks/phase-4-editor-tier1/README.md.
- Add Phase 4 capability builders for timeframes, panes, syminfo fields, drawing budgets, alert conditions, and logs.
- Wire runtime `barstate`, `syminfo`, and `timeframe` views, and add optional adapter symbol metadata for `syminfo` population.
- Resolve runtime `input.*` overrides at mount, add adapter input resolver wiring, and audit universal `ta.*` offset support.

### Patch Changes

- b0d296b: Phase-3 Task 1 — `draw.*` type surface foundation.

  Adds the canonical Phase-3 type surface to `@invinite-org/chartlang-core`:

  - `DrawingKind` — 61-entry kebab-case discriminated union (lines /
    boxes / curves / freehand / annotations / channels / fib / gann /
    pitchforks / patterns / elliott / cycles / containers). The
    kebab-case wire format is the source-of-truth; the camelCase
    TypeScript surface (`draw.horizontalLine`, `draw.fibRetracement`,
    …) is pinned via the `KIND_CAMELCASE` / `KIND_KEBABCASE` bijection.
  - `DRAWING_KINDS` — iterable form of `DrawingKind` in canonical
    declaration order.
  - `WorldPoint` + `AnchorPair` / `AnchorTriple` / `AnchorQuad` /
    `AnchorQuint` / `AnchorHept` helpers.
  - `DrawingState` — discriminated union with one variant per kind.
    Geometry + style fields only; collab-only fields (Yjs ids,
    layerIds, intervals, parentGroupId/FrameId, createdAt, authorId)
    from the invinite source are stripped per PLAN.md §10.4. Variants
    are minimal shells in this task; Tasks 5–18 refine per-category
    payloads.
  - Per-kind style bag types: `LineDrawStyle`, `ShapeStyle`,
    `HighlighterStyle`, `BrushStyle`, `TextOpts`, `ArrowOpts`,
    `ArrowMarkerOpts`, `PathOpts`, `FibOpts`, `RegressionTrendOpts`,
    `FrameOpts`.
  - `DrawingHandle` — script-facing handle returned by every
    `draw.<kind>(...)` call. Impl lives in the runtime (Task 3).
  - `DrawNamespace` + `FibSubNamespace` / `GannSubNamespace` /
    `ElliottSubNamespace` / `PatternSubNamespace` — the type the
    runtime swaps the throwing-stub `draw` Proxy for at boot. The
    stub mirrors the `plot` / `hline` / `alert` pattern from
    `plot/plot.ts`.
  - `DrawingBucket` + `KIND_BUCKET` + `bucketFor(kind)` — canonical
    kind → bucket map (`lines` / `labels` / `boxes` / `polylines` /
    `other`). Consumed by the runtime budget enforcer (Task 3) and
    by adapters that pre-budget.
  - `DrawingCounts` — moved here from `@invinite-org/chartlang-adapter-kit`
    so `ScriptManifest.maxDrawings?: DrawingCounts` and
    `Capabilities.maxDrawingsPerScript` pin the same shape without
    introducing a `core → adapter-kit` dependency cycle. The
    `adapter-kit` `DrawingCounts` export is now a type re-export of
    the core declaration — no public-surface drift, no consumer-visible
    change.
  - `ScriptManifest.maxDrawings?: DrawingCounts` + matching
    `DefineIndicatorOpts.maxDrawings?: DrawingCounts` propagation.

  Extends `STATEFUL_PRIMITIVES` by 61 `draw.<camelKind>` entries (all
  `slot: true`). Cardinality grows from **93 → 154**. The new entries
  follow the canonical `DRAWING_KINDS` order. The compiler's
  `callsiteIdInjection` + `statefulCallInLoop` passes pick them up by
  name automatically.

  No runtime behavior change in this task — `draw` is a throwing-stub
  Proxy until Task 3 wires the runtime emit infra. Phase-3 downstream
  tasks (2–22) all import from this surface.

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
