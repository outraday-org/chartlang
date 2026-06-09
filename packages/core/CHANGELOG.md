# @invinite-org/chartlang-core

## 0.5.0

### Phase 5

#### Minor Changes

- Ship Phase 5 color helpers from PLAN §11.4: `color.fromGradient`, `color.withAlpha`, `color.rgb`, and `color.hsl`.
- Add canonical StateSnapshot, StreamSnapshot, and StateStoreKey type declarations for PLAN.md §6.1 and §6.9 persistence.
- Ship Phase 5 `defineAlertCondition`, compiler manifest extraction, runtime `signal()` emissions, adapter validation, and conformance coverage per PLAN §11.2.
- Add `draw.table` with `TableCell`/`TablePosition` types, runtime emission,
  viewport-anchored canvas2d rendering, and conformance coverage per PLAN §10.2.
- Add Phase 5 plot kinds, runtime emission dispatch, validation, conformance scenarios, and canvas2d reference renderers.
- Add the Phase 5 `runtime.log.*` and `runtime.error()` surface, log emissions, runtime halt diagnostics, and conformance coverage.
- Replace the Phase 4 `request.security` NaN-only path with real
  multi-timeframe secondary stream alignment per PLAN.md §6.8 and §7.2.
  Adapters can route tagged `CandleEvent.streamKey` candles, the worker
  host dispatches them through `ScriptRunner.push`, conformance includes
  MTF scenarios, and the private canvas2d reference adapter now declares
  `multiTimeframe: true`.
- Port `ta.anchoredVolumeProfile` from invinite commit 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4, adding the PLAN §9.2 horizontal-histogram volume-profile primitive and PLAN §10.1.1 input-time anchor workflow.
- Add `ta.fixedRangeVolumeProfile`, completing the Phase 5 volume-profile set
  from PLAN §9.2 and §10.1.1 with fixed `[from, to]` anchors, frozen post-range
  histograms, and `fixed-range-inverted` diagnostics. Ported from invinite
  commit `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4`.
- Port `ta.sessionVolumeProfile` from invinite commit 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4, adding the PLAN §9.2 horizontal-histogram session volume-profile primitive, PLAN §4.8 syminfo-session fallback diagnostics, and compiler/runtime registration.
- Add `ta.visibleRangeVolumeProfile` per PLAN §9.2, ported from invinite commit `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4`, with runtime histogram emission, compiler/core type surfaces, conformance coverage, and generated docs.

## 0.4.0

### Minor Changes

- 3f3ce38: Replace the Phase-0 placeholder with the Phase-1 typed surface:
  `defineIndicator` / `defineAlert` constructors, the `ta` / `plot` / `alert`
  callable holes the compiler retargets at the runtime, the frozen
  `STATEFUL_PRIMITIVES` registry, and every §4.3 type. Nothing executes —
  `core` ships types and callable surfaces only; the runtime ships the real
  implementations in Tasks 5-8.
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

- 38fb475: Phase-2 Task 13 — momentum ports (`ta.ao`, `ta.cmo`, `ta.momentum`,
  `ta.roc`).

  Ships four new momentum primitives under `packages/runtime/src/ta/`:

  - `ta.ao(opts?)` — Awesome Oscillator. `SMA(hl2, fastLength) − SMA(hl2,
slowLength)`. Defaults to Pine-canonical `5` / `34`. Composes two
    `ta.sma` sub-slots (`${slotId}/fastSma`, `${slotId}/slowSma`); a fix
    to `sma` flows in for free.
  - `ta.cmo(source, length, opts?)` — Chande Momentum Oscillator. Range
    `[-100, 100]`. Trailing-window of per-bar gain / loss diffs with
    incremental sum maintenance + flat-line (zero-denominator) NaN
    guard.
  - `ta.momentum(source, length, opts?)` — Pine `mom`. First-difference
    `source[0] − source[length]`. Implemented as a thin shim around
    `ta.change` (`${slotId}/change` sub-slot) — no private subtraction
    loop.
  - `ta.roc(source, length, opts?)` — Rate of Change. `100 ×
(source[0] − source[length]) / source[length]`. Zero lookback →
    NaN.

  Each primitive ships the §22.10 set: impl + unit + property + golden +
  bench pair + conformance scenario (using the Phase-2 `inlineSource`
  extension from Task 1) + auto-generated `docs/primitives/ta/<id>.md`.

  `STATEFUL_PRIMITIVES` gains four new `slot: true` entries; `TaNamespace`

  - `RuntimeTaNamespace` gain four new methods; `TA_REGISTRY` gains four
    new entries. Four new opts types exported from core: `AoOpts`,
    `CmoOpts`, `MomentumOpts`, `RocOpts` (each carries `offset?: number` and
    `lineStyle?: PlotLineStyle` forward-compat fields; `AoOpts` also
    carries `fastLength?: number`, `slowLength?: number`).

  Provenance: ported from `invinite/src/components/trading-chart/
indicators/{ao,cmo,momentum,roc}.ts` at commit
  `078f41fe2569d659d5aba726da8bcb5d3e2ced02`.

- 38fb475: Phase-2 Task 14 — momentum ports (`ta.pmo`, `ta.smi`, `ta.tsi`).

  Ships three double-smoothed momentum primitives under
  `packages/runtime/src/ta/`:

  - `ta.pmo(source, opts?)` — Carl Swenlin's Price Momentum Oscillator
    (`{ pmo, signal }`). Three-pass smoothing of the 1-bar ROC, scaled
    to PMO's characteristic ±10 swing range. The two inner stages use
    a non-canonical "Swenlin EMA" factor (`α = 2 / length`) instead of
    the standard `α = 2 / (length + 1)`; the signal-line EMA composes
    the canonical `ta.ema` via a `${slotId}/signal` sub-slot. Defaults
    `(firstSmoothing, secondSmoothing, signalLength) = (35, 20, 10)`
    per TradingView's published formula.
  - `ta.smi(opts?)` — William Blau's Stochastic Momentum Index
    (`{ smi, signal }`). Composes `ta.highest` over `bar.high` and
    `ta.lowest` over `bar.low` (`kLength` window) for the rolling
    midpoint and range, then double-EMA-smooths both numerator
    (`bar.close − midpoint`) and denominator (`range / 2`) through two
    EMA layers each, then computes `100 × numSmoothed / denSmoothed`
    and feeds it through a signal EMA. Bounded `[-100, 100]` (flat
    range → NaN at smi). Defaults `(kLength, firstSmoothing,
secondSmoothing, dLength) = (10, 3, 5, 3)`.
  - `ta.tsi(source, opts?)` — William Blau's True Strength Index
    (momentum-class; `{ tsi, signal }`). Double-EMA-smoothed ratio of
    one-bar price changes vs their absolute values, scaled ×100.
    Bounded `[-100, 100]` (flat input → NaN at tsi). Defaults
    `(firstSmoothing, secondSmoothing, signalLength) = (25, 13, 13)`
    per TradingView's published TSI study. Note: this is the
    **momentum**-class TSI; the **trend**-class True Strength Index
    ships in Task 17 as `ta.trendStrengthIndex`.

  Each primitive ships the §22.10 set: impl + unit + property +
  golden + bench pair + conformance scenario (using the Phase-2
  `inlineSource` extension from Task 1) + auto-generated
  `docs/primitives/ta/<id>.md` page.

  `TA_REGISTRY_METADATA` extends with three new entries: `pmo` and
  `tsi` advertise `primarySeriesKey` + `visibleSeriesKeys` with
  `yDomain: { kind: "auto" }`; `smi` is `{ kind: "fixed", min: -100,
max: 100 }`.

  Core surface widens with `PmoOpts` / `PmoResult`, `SmiOpts` /
  `SmiResult`, `TsiOpts` / `TsiResult` plus matching `TaNamespace`
  methods and throw-sentinel stubs. `STATEFUL_PRIMITIVES` extends
  with `ta.pmo` / `ta.smi` / `ta.tsi` (all `slot: true`).

  Three conformance scenarios (`taPmo.scenario.ts`,
  `taSmi.scenario.ts`, `taTsi.scenario.ts`) registered against
  `PHASE_1_SCENARIOS` via the Task-1 `inlineSource` extension.
  Plot-hash pinning deferred to Phase-2 closeout (Task 30) per the
  established cross-functional scenario convention.

  Provenance: ported from `invinite/src/components/trading-chart/
indicators/{pmo,smi,tsi}.ts` at commit
  `078f41fe2569d659d5aba726da8bcb5d3e2ced02`.

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

- 38fb475: Phase-2 Task 9 — oscillator ports: `ta.cci`, `ta.stoch`, `ta.williamsR`.

  Ships three foundational momentum / oscillator primitives under
  `packages/runtime/src/ta/`:

  - `ta.cci(source, length, opts?)` — Commodity Channel Index over a
    configurable source (typically `bar.hlc3`). Lambert constant
    `scaling = 0.015` hard-coded; flat-window (`meanDev === 0`) emits
    `NaN`. Unbounded by construction.
  - `ta.stoch(opts?)` — Stochastic Oscillator (`%K` + `%D`) over
    `bar.high` / `bar.low` / `bar.close`. Composes `ta.highest` +
    `ta.lowest` + two chained `ta.sma` smoothing layers via sub-slot
    ids. Bounded `[0, 100]` (or `NaN`). Defaults `(kLength=14,
kSmoothing=3, dLength=3)`.
  - `ta.williamsR(length, opts?)` — Williams %R over `bar.high` /
    `bar.low` / `bar.close`. Composes `ta.highest` + `ta.lowest`.
    Bounded `[-100, 0]` (or `NaN`).

  Each primitive ships the §22.10 set: impl + unit + property + golden

  - bench pair + conformance scenario (inlined per Task 1) +
    auto-generated `docs/primitives/ta/<id>.md`.

  Introduces a new metadata layer on the runtime registry:

  - `TA_REGISTRY_METADATA: Readonly<Partial<Record<keyof typeof
TA_REGISTRY, PrimitiveMetadata>>>` — per-primitive `primarySeriesKey`,
    `visibleSeriesKeys`, and `yDomain` hints for renderers (pane layout,
    legend ordering, y-axis scaling). `ta.stoch` records
    `primarySeriesKey: "k"`, `visibleSeriesKeys: ["k", "d"]`,
    `yDomain: { kind: "fixed", min: 0, max: 100 }`; `ta.williamsR`
    records `yDomain: { kind: "fixed", min: -100, max: 0 }`. Unbounded
    primitives (e.g. `ta.cci`, `ta.sma`) carry no metadata entry —
    consumers default to `auto`.

  Core surface widens with `CciOpts`, `StochOpts`, `WilliamsROpts` opts
  bags + `StochResult` two-output type, plus the matching `TaNamespace`
  methods and throw-sentinel stubs. `STATEFUL_PRIMITIVES` extends with
  `ta.cci` / `ta.stoch` / `ta.williamsR` (all `slot: true`). Compiler
  shim mirrors the new core surface.

  Three conformance scenarios (`taCci.scenario.ts`, `taStoch.scenario.ts`,
  `taWilliamsR.scenario.ts`) registered against `PHASE_1_SCENARIOS` via
  the Task-1 `inlineSource` extension. Plot-hash pinning deferred to
  Phase-2 closeout (Task 30) per the established cross-functional
  scenario convention.

  DIVERGENCE from invinite reference (`stoch.ts`): the spec requires
  flat-window (`hh === ll`) → `NaN` at `k`, whereas invinite falls back
  to the prior valid kRaw (or 50 on the first slot, per TradingView).
  The task spec overrides; documented in the impl's provenance header.

  `CciOpts` intentionally narrows away invinite's `scaling` knob —
  chartlang hard-codes the canonical Lambert constant.

- 38fb475: Phase-2 Task 12 — oscillator ports: `ta.kst`, `ta.fisher`,
  `ta.klinger`, `ta.rvgi`.

  Ships four more multi-output oscillator primitives under
  `packages/runtime/src/ta/`:

  - `ta.kst(source, opts?)` — Know Sure Thing (Martin Pring, 1992).
    Weighted sum of four SMA-smoothed percentage ROCs plus an SMA
    signal line. Composes 4 `ta.sma` sub-slots for the per-ROC
    smoothing plus one `ta.sma` for the signal; the four percentage
    ROCs are computed inline against a shared `sourceWindow` ring
    (mirrors `ta.coppock` — `ta.change` emits absolute deltas, while
    KST needs percentage rate-of-change). Defaults
    `(10, 15, 20, 30, 10, 10, 10, 15, 9)`.
  - `ta.fisher(length, opts?)` — John Ehlers' Fisher Transform over
    rolling `bar.hl2`. Composes `ta.highest` + `ta.lowest` sub-slots;
    the clamp / atanh / EMA-blend recurrence is bespoke. The `trigger`
    output is the prior bar's `fisher` value (1-bar lag); first bar's
    `trigger` is NaN. Diverges from invinite's ±0.999 clamp per task
    spec — when the recurrence would drive `|x| ≥ 1` we emit NaN at
    `fisher` and hold the recurrence state.
  - `ta.klinger(opts?)` — Klinger Volume Oscillator. Per-bar Volume
    Force accumulator drives the difference of two `ta.ema` sub-slots
    (`fastLength` / `slowLength`); the `signal` is a third
    `ta.ema(klinger, signalLength)`. Defaults `(34, 55, 13)`.
  - `ta.rvgi(opts?)` — Relative Vigor Index (John Ehlers, 2002).
    4-bar `(1, 2, 2, 1) / 6` weighted numerator (`close − open`) and
    denominator (`high − low`), each smoothed via `ta.sma` sub-slot;
    `rvgi = numSma / denSma`. Signal is a 4-bar weighted sum of the
    rvgi line. Defaults `length = 10`; flat-range bars emit NaN.

  Each primitive ships the §22.10 set: impl + unit + property + golden

  - bench pair + conformance scenario (inlined per Task 1) +
    auto-generated `docs/primitives/ta/<id>.md`.

  Extends `TA_REGISTRY_METADATA` with four new entries (all
  `primarySeriesKey` + `visibleSeriesKeys`; all `yDomain: { kind:
"auto" }` per task §5):

  - `kst`: `primarySeriesKey: "kst"`, `visibleSeriesKeys: ["kst", "signal"]`.
  - `fisher`: `primarySeriesKey: "fisher"`, `visibleSeriesKeys: ["fisher", "trigger"]`.
  - `klinger`: `primarySeriesKey: "klinger"`, `visibleSeriesKeys: ["klinger", "signal"]`.
  - `rvgi`: `primarySeriesKey: "rvgi"`, `visibleSeriesKeys: ["rvgi", "signal"]`.

  Core surface widens with `KstOpts`, `FisherOpts`, `KlingerOpts`,
  `RvgiOpts` opts bags + `KstResult`, `FisherResult`, `KlingerResult`,
  `RvgiResult` two-output types, plus the matching `TaNamespace`
  methods and throw-sentinel stubs. `STATEFUL_PRIMITIVES` extends
  with `ta.kst` / `ta.fisher` / `ta.klinger` / `ta.rvgi` (all
  `slot: true`). Compiler shim mirrors the new core surface.

  Four conformance scenarios (`taKst.scenario.ts`,
  `taFisher.scenario.ts`, `taKlinger.scenario.ts`,
  `taRvgi.scenario.ts`) registered against `PHASE_1_SCENARIOS` via the
  Task-1 `inlineSource` extension. Plot-hash pinning deferred to
  Phase-2 closeout (Task 30) per the established multi-output scenario
  convention.

- 38fb475: Phase-2 Task 10 — oscillator ports: `ta.ppo`, `ta.dpo`,
  `ta.connorsRsi`.

  Ships three derived oscillator primitives under
  `packages/runtime/src/ta/`:

  - `ta.ppo(source, opts?)` — Percentage Price Oscillator, the
    scale-invariant cousin of MACD. Three outputs (`{ ppo, signal,
hist }`) over `100 * (fastEma - slowEma) / slowEma`. Composes three
    `ta.ema` sub-slots (`${slotId}/fast`, `${slotId}/slow`,
    `${slotId}/signal`) per §9.4 — folds invinite's private EMA copy
    onto the canonical primitive. Defaults `(12, 26, 9)`. `slow === 0`
    emits `NaN` at the PPO line; signal can still be defined off prior
    values.
  - `ta.dpo(source, length, opts?)` — Detrended Price Oscillator
    (non-centered, TradingView default). `dpo[i] = source[i -
displacement] - sma[i]` with `displacement = floor(length / 2) +
1`. Composes one `ta.sma` sub-slot plus a per-slot source-window
    Float64RingBuffer for the O(1) per-bar shifted-source lookup.
  - `ta.connorsRsi(source, opts?)` — Connors RSI, a `[0, 100]`-bounded
    blend of `RSI(source, rsiLength)`, `RSI(streak, streakLength)`,
    and `PercentRank(ROC(source, 1), rocLength)`. Composes two
    `ta.rsi` sub-slots — no private RSI math duplication. Defaults
    `(3, 2, 100)`. Sub-component NaN → component skipped in the
    average (per task spec §6, diverges from invinite's stricter
    all-finite requirement to align with the Pine semantic).

  Each primitive ships the §22.10 set: impl + unit + property +
  golden + bench pair + conformance scenario (inlined per Task 1) +
  auto-generated `docs/primitives/ta/<id>.md`.

  `TA_REGISTRY_METADATA` extends with:

  - `ppo`: `primarySeriesKey: "ppo"`, `visibleSeriesKeys: ["ppo",
"signal", "hist"]`, `yDomain: { kind: "auto" }`.
  - `connorsRsi`: `yDomain: { kind: "fixed", min: 0, max: 100 }`.
  - `dpo`: no metadata entry (unbounded — consumers default to
    `auto`).

  Core surface widens with `PpoOpts`, `DpoOpts`, `ConnorsRsiOpts`
  opts bags + `PpoResult` three-output type, plus the matching
  `TaNamespace` methods and throw-sentinel stubs.
  `STATEFUL_PRIMITIVES` extends with `ta.ppo` / `ta.dpo` /
  `ta.connorsRsi` (all `slot: true`). Compiler shim mirrors the new
  core surface.

  Three conformance scenarios (`taPpo.scenario.ts`,
  `taDpo.scenario.ts`, `taConnorsRsi.scenario.ts`) registered against
  `PHASE_1_SCENARIOS` via the Task-1 `inlineSource` extension.
  Plot-hash pinning deferred to Phase-2 closeout (Task 30) per the
  established cross-functional scenario convention.

  DEVIATIONS from invinite reference (commit
  `078f41fe2569d659d5aba726da8bcb5d3e2ced02`):

  - `ppo.ts` — invinite carries a private EMA copy
    (`computeMaSeries(oscillatorMaType, ...)`); chartlang routes
    through the canonical `ta.ema` primitive via sub-slot
    composition (matches `ta.macd`). §9.4 fold satisfied.
  - `dpo.ts` — only the non-centered (TradingView default) render
    mode is shipped. Invinite's `centered: true` mode emits
    `dpo[i] = src[i] - sma[i + displacement]`, which depends on the
    future SMA; chartlang's append-only ring-buffer contract can't
    backfill, so that mode is deferred. Documented in the impl's
    provenance header.
  - `connorsRsi.ts` — invinite requires all three components finite
    for the CRSI line to define; the task spec (§6) overrides with
    "sub-component NaN → component skipped in the average". We
    follow the spec, which tightens alignment with the Pine
    `ta.connorsRsi` semantic where streak-RSI warmup doesn't gate
    the rsi-on-close component.

- 38fb475: Phase-2 Task 11 — oscillator ports: `ta.stochRsi`, `ta.ultimateOsc`,
  `ta.coppock`.

  Ships three more oscillator primitives under
  `packages/runtime/src/ta/`:

  - `ta.stochRsi(source, opts?)` — Stochastic RSI (`%K` + `%D`).
    Composes `ta.rsi` + `ta.highest` + `ta.lowest` + two chained
    `ta.sma` smoothing layers via sub-slot ids. Bounded `[0, 100]`
    (or `NaN`). Defaults `(rsiLength=14, stochLength=14, kSmoothing=3,
dSmoothing=3)`. Flat-RSI-window (`hh === ll`) emits `NaN` at `k`
    — diverges from invinite's prev-or-50 fallback per task spec.
  - `ta.ultimateOsc(opts?)` — Larry Williams' Ultimate Oscillator over
    `bar.high` / `bar.low` / `bar.close`. Weighted average of three
    buying-pressure / true-range ratios across `shortLength` /
    `mediumLength` / `longLength` windows (defaults `7` / `14` / `28`).
    Bounded `[0, 100]` (or `NaN`); zero-TR window emits `NaN`.
  - `ta.coppock(source, opts?)` — Edwin Coppock's Curve.
    `WMA(ROC(source, roc1Length) + ROC(source, roc2Length),
wmaLength)` over percentage ROC. Defaults `(11, 14, 10)`. Unbounded;
    zero-crossings are the canonical signal. Inlines the percentage-ROC
    computation against its own `sourceWindow` (the spec's hint to
    compose `ta.change` does not fit — `ta.change` emits absolute
    deltas, not percentages).

  Each primitive ships the §22.10 set: impl + unit + property + golden

  - bench pair + conformance scenario (inlined per Task 1) +
    auto-generated `docs/primitives/ta/<id>.md`.

  Extends `TA_REGISTRY_METADATA` with two new bounded-oscillator
  entries:

  - `stochRsi`: `primarySeriesKey: "k"`, `visibleSeriesKeys: ["k", "d"]`,
    `yDomain: { kind: "fixed", min: 0, max: 100 }`.
  - `ultimateOsc`: `yDomain: { kind: "fixed", min: 0, max: 100 }`.

  `ta.coppock` is unbounded — no metadata entry; consumers default to
  `auto`.

  Core surface widens with `StochRsiOpts`, `UltimateOscOpts`,
  `CoppockOpts` opts bags + `StochRsiResult` two-output type, plus the
  matching `TaNamespace` methods and throw-sentinel stubs.
  `STATEFUL_PRIMITIVES` extends with `ta.stochRsi` / `ta.ultimateOsc` /
  `ta.coppock` (all `slot: true`). Compiler shim mirrors the new core
  surface.

  Three conformance scenarios (`taStochRsi.scenario.ts`,
  `taUltimateOsc.scenario.ts`, `taCoppock.scenario.ts`) registered
  against `PHASE_1_SCENARIOS` via the Task-1 `inlineSource` extension.
  Plot-hash pinning deferred to Phase-2 closeout (Task 30) per the
  established cross-functional scenario convention.

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

- 38fb475: Phase-2 Task 26 — S/R ports: `ta.chandelier`, `ta.chandeKrollStop`,
  `ta.williamsFractal`.

  Ships three new S/R `ta.*` primitives under
  `packages/runtime/src/ta/`:

  - `ta.chandelier(opts?)` — Chandelier Exit returning
    `{ long, short }`. Composes Phase-1 `ta.atr` plus Task-5
    `ta.highest` / `ta.lowest` at sub-slots `${slotId}/atr` /
    `${slotId}/highHigh` / `${slotId}/lowLow`. `long = highest(high,
length) − multiplier · atr(length)`; `short` symmetric. Defaults
    `length = 22`, `multiplier = 3` per Pine canonical. Source
    hard-coded to `bar.high` / `bar.low` (deliberate divergence from
    invinite's `source` parameter — matches Pine `ta.chandelier_exit`).

  - `ta.chandeKrollStop(opts?)` — Chande Kroll Stop returning
    `{ long, short }`. Two-pass smoothed trailing stop: first pass
    computes `firstHigh = highest(high, length) − multiplier · atr` /
    `firstLow = lowest(low, length) + multiplier · atr` (composed via
    `ta.atr` + `ta.highest` / `ta.lowest` sub-slots); second pass
    walks a slot-owned `Float64RingBuffer` of size `smoothingLength`
    for the rolling max / min. Defaults `length = 10`, `multiplier = 1`,
    `smoothingLength = 9` (matches Chande Kroll's 1995 paper).

  - `ta.williamsFractal(opts?)` — Williams Fractal returning
    `{ up, down }` as **price-level series** (NaN when no fractal,
    `bar.high(centre)` for up-fractal, `bar.low(centre)` for down).
    Self-contained centred-window scan over a `2 · length + 1` ring
    buffer per side. Output is centred: at live bar `t`, the value
    emitted reflects bar `t − length`'s fractal status (when bar `t`
    closes, we now have the right-window bars to confirm bar
    `t − length`). Default `length = 2` (5-bar window). Strict
    comparison: tied highs/lows in the window → no fractal.

    Deviation from the task spec's literal `Series<boolean>` wording:
    emits price levels instead so the `marker` plot has a meaningful
    y-anchor. Matches invinite's `upFractals[i] = high` shape.

  Each primitive ships the §22.10 set (impl + unit + property + golden
  hash + bench pair) plus a `taChandelier.scenario.ts`,
  `taChandeKrollStop.scenario.ts`, and `taWilliamsFractal.scenario.ts`
  conformance scenario. JSDoc per §17.2 with `@formula`, `@warmup`,
  `@since 0.2`, `@experimental`, `@example`, and `@anchors`.

  **`PlotOptsStyle` marker widening (core + runtime + compiler shim).**
  Adds the `marker` variant to `PlotOptsStyle` in core (mirrors the
  adapter-kit's `PlotStyle.marker` shape declared by Task 1), the
  matching dispatch branch to `buildStyle` in
  `packages/runtime/src/emit/plot.ts`, and the same widening in the
  compiler's ambient shim. The Williams Fractal scenario is the first
  to exercise the marker plot kind end-to-end. The cap-gated dispatch
  path is unit-covered in `plot.test.ts`'s new marker case.

  `TaNamespace` (core) and `RuntimeTaNamespace` (runtime) extend with
  three new methods + matching opts / result types. `STATEFUL_PRIMITIVES`
  appends three new `slot: true` entries. `TA_REGISTRY` adds three
  entries plus `TA_REGISTRY_METADATA` records for each
  (`primarySeriesKey` / `visibleSeriesKeys` / `yDomain = auto`).

  Auto-generated documentation pages land at
  `docs/primitives/ta/{chandelier,chandeKrollStop,williamsFractal}.md`
  via the Task-2 generator. The `docs/primitives/ta/index.md` carries a
  new "S/R (Task 26)" subsection.

- 38fb475: Phase-2 Task 25 — S/R ports: `ta.psar` and `ta.supertrend`.

  Ships two new flagship trend-following S/R `ta.*` primitives under
  `packages/runtime/src/ta/`:

  - `ta.psar(opts?)` — Wilder Parabolic SAR returning
    `{ sar, direction }`. Self-contained state machine over
    `bar.high` / `bar.low` / `bar.close` with extreme-point +
    acceleration-factor tracking and trend-flip semantics. Defaults
    `accelerationStart = 0.02`, `accelerationStep = 0.02`,
    `accelerationMax = 0.2` per Pine / Wilder. Bar 0 emits the seed
    (`sar = bar.low`, `direction = +1`); bar 1 decides the initial
    direction from `close[1] >= close[0]`; bar 2+ runs the standard
    recurrence with the lower/upper-bound clamps against the prior
    two bars' lows/highs.
  - `ta.supertrend(opts?)` — ATR-driven trailing-stop trend follower
    returning `{ line, direction }`. Composes Phase-1 `ta.atr` at
    sub-slot `${slotId}/atr`, so a fix to ATR flows in for free.
    Defaults `length = 10`, `multiplier = 3`. Reads `bar.hl2` for the
    band midpoint (Pine-canonical). The final-band persistence rule
    carries the prior band forward unless the prior close pierced it;
    direction flips when the current close crosses the prior
    `finalUpper` / `finalLower`.

  Both primitives suspend their recurrence state on NaN OHLC so the
  next finite bar resumes from the prior state. `replaceHead`
  correctness is asserted via append-vs-replaceHead property tests
  over adversarial sharp-reversal sequences — both implementations
  snapshot the state at the start of each bar BEFORE the close-side
  recurrence advances so a final tick replays from the seed.

  Each primitive ships the §22.10 set: impl + unit + property +
  golden + bench pair + conformance scenario (using the Phase-2
  `inlineSource` extension from Task 1) + auto-generated
  `docs/primitives/ta/<id>.md`. `TA_REGISTRY_METADATA` carries the
  multi-output / y-domain hints (`psar: { primarySeriesKey: "sar",
visibleSeriesKeys: ["sar", "direction"], yDomain: auto }`,
  `supertrend: { primarySeriesKey: "line", visibleSeriesKeys:
["line", "direction"], yDomain: auto }`).

  Core adds `PsarOpts`, `PsarResult`, `SupertrendOpts`,
  `SupertrendResult` exports + the two `TaNamespace` methods.
  `STATEFUL_PRIMITIVES` grows by 2 (`ta.psar`, `ta.supertrend`; both
  `slot: true`). `TA_REGISTRY` mirrors with the leading
  `slotId: string` on each method.

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

- 38fb475: Phase-2 Task 28 — statistical `ta.*` ports: `ta.median`, `ta.adr`,
  `ta.ulcerIndex`.

  Ships three new statistical primitives under
  `packages/runtime/src/ta/`:

  - `ta.median(source, length, opts?)` — rolling median over the
    trailing `length` source values. Odd-`length` → middle value;
    even-`length` → mean of the two middle values. NaN slots are
    dropped from the sort (window length effectively shrinks). Range
    invariant pinned: `min(window) ≤ out ≤ max(window)`. Tick-mode
    substitutes the head value before sorting (closed window
    unchanged).
  - `ta.adr(opts?)` — Average Daily Range. SMA of `high − low` over
    the trailing `length` (default `14`) completed UTC calendar days.
    Reads `bar.high` / `bar.low` / `bar.time` directly (no `source`
    param). Phase-2 keys "daily" on the UTC midnight boundary
    (`Math.floor(bar.time / 86_400_000)`); Phase 4 lifts this onto
    `syminfo.session`. The in-progress (currently-aggregating) day is
    NEVER included in the average — matches invinite's "completed N
    daily bars" semantics. Tick mode emits the cached SMA (no day-
    boundary advance per the runtime tick invariant).
  - `ta.ulcerIndex(source, length, opts?)` — drawdown-based volatility
    (rolling RMS of percent declines from the rolling-window high).
    Composes `ta.highest` via sub-slot id `${slotId}/highest`. Range
    invariant pinned: `out ≥ 0`. NaN source → NaN output (window
    unchanged).

  Each primitive ships the §22.10 set: impl + unit + property +
  golden + bench pair + conformance scenario (inline-source per Task
  1's extension) + auto-generated `docs/primitives/ta/<id>.md`.

  `STATEFUL_PRIMITIVES` grows by `+3` (`ta.median`, `ta.adr`,
  `ta.ulcerIndex` — all `slot: true`). `TA_REGISTRY` grows by `+3`.
  `TaNamespace` and `RuntimeTaNamespace` extend in lockstep with
  `MedianOpts`, `AdrOpts` (`{ length?: number; offset?: number;
lineStyle?: PlotLineStyle }`), and `UlcerIndexOpts`.

  `PHASE_1_SCENARIOS` (conformance) grows by `+3`. The three new
  scenarios assert `alert-count: 0` + the standard
  `lookback-exceeded` / `malformed-emission` diagnostic-absent gates
  (no `plot-hash` — the rolling primitives' outputs are pinned
  elsewhere via the runtime golden tests).

- 38fb475: Phase-2 Task 16 — trend ports: `ta.adx`, `ta.dmi`, `ta.trix`.

  Ships three new trend `ta.*` primitives under
  `packages/runtime/src/ta/`:

  - `ta.adx(length, opts?)` — Wilder's Average Directional Index
    (single Series bounded `[0, 100]`). Reads `bar.high` /
    `bar.low` / `bar.close` directly (mirrors Pine's `ta.adx(length)`
    — no source param). Composes the same Wilder DI recurrence
    `ta.dmi` runs, then folds DX through a second
    Wilder-smoothing window of length `opts.smoothing ?? 14`.
  - `ta.dmi(length, opts?)` — Wilder's Directional Movement Index
    (`{ plusDi, minusDi }`, both ∈ [0, 100]). Reads OHLC directly
    per Pine's `ta.dmi(length)`. Incremental `wilderStep` over
    `+DM` / `−DM` / TR; output validated against the
    full-recompute reference `lib/wilderDirectional`.
  - `ta.trix(source, length, opts?)` — TRIX triple-smoothed EMA
    rate-of-change with an EMA-signal line (`{ trix, signal }`).
    Composes three EMA sub-slots (`${slotId}/ema1` / `/ema2` /
    `/ema3`) for the triple chain + a fourth `${slotId}/signal`
    EMA, mirroring the MACD sub-slot composition pattern.

  Each primitive ships the §22.10 set: impl + unit + property +
  golden + bench pair + conformance scenario (using the Phase-2
  `inlineSource` extension from Task 1) + auto-generated
  `docs/primitives/ta/<id>.md`. `TA_REGISTRY_METADATA` carries
  y-domain + multi-output hints (`adx: { yDomain: fixed 0-100 }`,
  `dmi: { primarySeriesKey: "plusDi", visibleSeriesKeys: ["plusDi",
"minusDi"], yDomain: fixed 0-100 }`, `trix: { primarySeriesKey:
"trix", visibleSeriesKeys: ["trix", "signal"], yDomain: auto }`).

  ADX / DMI reuse Phase-1 `lib/wilderSmoothing` (`wilderStep`) for
  the per-bar Wilder recurrence and Wave-3 Task-4
  `lib/wilderDirectional` + `lib/adxFromDi` as the property-test
  reference (Float64Array-in / Float64Array-out full-recompute).
  TRIX reuses Phase-1 `lib/emaFloat64` (`computeEmaOfFloat64`) as
  the property-test reference plus the runtime `ta.ema` primitive
  for the four composed sub-slots.

  Core adds `AdxOpts`, `DmiOpts`, `DmiResult`, `TrixOpts`,
  `TrixResult` exports plus three new methods on `TaNamespace`.
  `STATEFUL_PRIMITIVES` grows by 3 (`ta.adx`, `ta.dmi`, `ta.trix`;
  all `slot: true`). `TA_REGISTRY` mirrors with the leading
  `slotId: string` on each method.

- 38fb475: Phase-2 Task 15 — trend ports: `ta.aroon` and `ta.aroonOsc`.

  Ships two new trend `ta.*` primitives under
  `packages/runtime/src/ta/`:

  - `ta.aroon(length, opts?)` — Aroon Up / Down (`{ up, down }`,
    both ∈ [0, 100]). Reads `bar.high` / `bar.low` directly per
    Pine's `ta.aroon(length)` signature (no source param). Scans the
    trailing `length + 1` window per close for the argmax / argmin
    using strict `>` / `<` so the most-recent tied bar wins
    (TradingView convention). Tick replay substitutes the head value
    without mutating the closed window.
  - `ta.aroonOsc(length, opts?)` — `aroon.up − aroon.down`, bounded
    in [-100, 100]. Composes `ta.aroon` at sub-slot
    `${slotId}/aroon` so a fix to Aroon flows in for free.

  Each primitive ships the §22.10 set: impl + unit + property + golden

  - bench pair + conformance scenario (using the Phase-2 `inlineSource`
    extension from Task 1) + auto-generated `docs/primitives/ta/<id>.md`.
    `TA_REGISTRY_METADATA` carries the multi-output / y-domain hints
    (`aroon: { primarySeriesKey: "up", visibleSeriesKeys: ["up", "down"],
yDomain: fixed 0-100 }`, `aroonOsc: { yDomain: fixed -100-100 }`).

  Core adds `AroonOpts`, `AroonOscOpts`, `AroonResult` exports + the
  two `TaNamespace` methods. `STATEFUL_PRIMITIVES` grows by 2
  (`ta.aroon`, `ta.aroonOsc`; both `slot: true`). `TA_REGISTRY`
  mirrors with the leading `slotId: string` on each method.

- 38fb475: Phase-2 Task 17 — trend ports: `ta.vortex`, `ta.trendStrengthIndex`,
  `ta.ichimoku`.

  Ships three new trend `ta.*` primitives under
  `packages/runtime/src/ta/`:

  - `ta.vortex(length, opts?)` — Botes & Siepman (2010) Vortex
    Indicator. Reads `bar.high` / `bar.low` / `bar.close` directly
    (mirrors Pine's `ta.vortex(length)` — no source param). Returns
    `{ plus, minus }` (the +VI / −VI lines). Maintains rolling
    running-sum windows over per-bar `vmPlus`, `vmMinus`, and TR for
    O(1) per-bar updates. NaN-on-zero-TR semantic per chartlang task
    spec §6 (invinite emits 0 on zero TR; chartlang surfaces the
    degenerate window).
  - `ta.trendStrengthIndex(source, length, opts?)` — TradingView's
    Trend Strength Index: Pearson correlation between `source` and
    bar index over each trailing `length`-bar window. Bounded
    `[-1, +1]`. Default `length = 20` (chartlang task spec; invinite
    default is 14). Distinct from `ta.tsi` (Task 14's True Strength
    Index momentum oscillator) — name collision avoided via the
    longer `trendStrengthIndex` surface.
  - `ta.ichimoku(opts?)` — Ichimoku Cloud (Tenkan / Kijun / Senkou A
    / Senkou B / Chikou). Defaults `(conversionLength=9, baseLength=
26, leadingSpanBLength=52, displacement=26)`. Composes six
    `ta.highest` / `ta.lowest` sub-slots (one pair each for Tenkan /
    Kijun / Senkou B) — the same composition seam `ta.donchian` uses
    — so a fix to either rolling-extreme primitive flows in for free.
    Forward-displaced Senkou A / Senkou B and backward-displaced
    Chikou are produced via per-slot delay ring buffers of capacity
    `displacement + 1`. `chikou.current` returns `close[t −
displacement]` (the backward-shifted close — programmatic
    semantic for script-author conditionals).

  Each primitive ships the §22.10 set: impl + unit + property +
  golden + bench pair + conformance scenario (using the Phase-2
  `inlineSource` extension from Task 1) + auto-generated
  `docs/primitives/ta/<id>.md`. `TA_REGISTRY_METADATA` carries
  y-domain + multi-output hints:

  - `vortex: { primarySeriesKey: "plus", visibleSeriesKeys:
["plus", "minus"], yDomain: auto }`
  - `trendStrengthIndex: { yDomain: fixed [-1, 1] }`
  - `ichimoku: { primarySeriesKey: "tenkan", visibleSeriesKeys:
["tenkan", "kijun", "senkouA", "senkouB", "chikou"], yDomain:
auto }` (the cloud renders via the Task-1 `filled-band` PlotKind
    between `senkouA` and `senkouB` — script-author drives the
    styling in their `plot()` call).

  Reuse:

  - Vortex's property test uses Phase-1 `lib/trSeries.ts`
    (`computeTrSeries`) as the per-bar TR reference; golden test
    pins the per-output hashes of a 100-bar Mulberry32 fixture.
  - TrendStrengthIndex's property test uses Wave-3 `lib/pearson.ts`
    against a linear bar-index series as the reference.
  - Ichimoku's property test uses Wave-3 `lib/donchianMid.ts` as the
    per-line reference (Tenkan / Kijun / SenkouB raw all share the
    same Donchian-midpoint math).

  Core adds `VortexOpts`, `VortexResult`, `TrendStrengthIndexOpts`,
  `IchimokuOpts`, `IchimokuResult` exports plus three new methods
  on `TaNamespace` + three throwing stubs on the `ta` const.
  `STATEFUL_PRIMITIVES` grows by 3 (`ta.vortex`,
  `ta.trendStrengthIndex`, `ta.ichimoku`; all `slot: true`) — final
  Phase-2 size 93. `TA_REGISTRY` grows by 3 — final size 90.
  Conformance scenarios + `PHASE_1_SCENARIOS` array grow by 3.

- 38fb475: Phase-2 Task 18 — volatility ports: `ta.bbPercentB`, `ta.bbw`, and
  `ta.donchian`.

  Ships three new volatility `ta.*` primitives under
  `packages/runtime/src/ta/`:

  - `ta.bbPercentB(source, length, opts?)` — Bollinger %B,
    `(src − lower) / (upper − lower)` over the BB envelope. NaN
    when the band collapses (zero width). Composes `ta.bb` via
    sub-slot `${slotId}/bb` so a fix to the envelope flows in for
    free. Default `multiplier = 2`.
  - `ta.bbw(source, length, opts?)` — Bollinger BandWidth,
    `(upper − lower) / middle` over the BB envelope. Raw ratio
    scale (multiply by 100 in the script for TradingView-parity
    display). NaN on zero middle. Composes `ta.bb` via the same
    sub-slot pattern. Default `multiplier = 2`.
  - `ta.donchian(length, opts?)` — Donchian Channels,
    `{ upper, middle, lower }` over a fixed `length`-bar window.
    `upper = highest(bar.high, length)` and `lower =
lowest(bar.low, length)` via sub-slots `${slotId}/highest` /
    `${slotId}/lowest` — the slot-aware composition of the
    registered Task-5 primitives; equivalent to `lib/donchianMid`
    but routed through the registry so a fix flows in for free.
    Mid = `(upper + lower) / 2`.

  Each primitive ships the §22.10 set: impl + unit + property +
  golden + bench pair + conformance scenario (using the Phase-2
  `inlineSource` extension from Task 1) + auto-generated
  `docs/primitives/ta/<id>.md`. `TA_REGISTRY_METADATA.donchian`
  records the multi-output hints (`primarySeriesKey: "middle"`,
  `visibleSeriesKeys: ["upper", "middle", "lower"]`,
  `yDomain: { kind: "auto" }`).

  Core adds `BbPercentBOpts`, `BbwOpts`, `DonchianOpts`,
  `DonchianResult` exports + the three `TaNamespace` methods.
  `STATEFUL_PRIMITIVES` grows by 3 (all three `slot: true`).
  `TA_REGISTRY` mirrors with the leading `slotId: string` on each
  method.

- 38fb475: Phase-2 Task 20 — volatility ports: `ta.historicalVolatility`,
  `ta.rvi`, and `ta.massIndex`.

  Ships three new volatility `ta.*` primitives under
  `packages/runtime/src/ta/`:

  - `ta.historicalVolatility(source, length, opts?)` — annualised
    stddev of log returns ×100. Default `annualisationFactor = 365`
    (TradingView's "Crypto" convention; use `252` for trading-day
    equity series). NaN through `[0, length − 1]` warmup; non-positive
    or non-finite source short-circuits log returns to NaN.
  - `ta.rvi(source, length, opts?)` — Relative Volatility Index, the
    RSI-style oscillator that uses rolling stddev of the source as
    the magnitude instead of absolute close changes. Bounded `[0, 100]`.
    Composes `ta.ema` via sub-slots `${slotId}/upEma` and
    `${slotId}/downEma` so a fix to EMA's recurrence flows in for
    free. Warmup `2 · length − 1`. NaN on zero-denominator (both EMA
    arms zero).
  - `ta.massIndex(opts?)` — sub-pane volatility line that tracks the
    range-EMA "bulge" ratio to flag trend-reversal setups via the
    canonical 27 threshold. Reads `bar.high − bar.low` directly (no
    source param). Composes two chained `ta.ema` sub-slots
    (`${slotId}/ema1`, `${slotId}/ema2`). Defaults `emaLength = 9`,
    `sumLength = 25`. Warmup `2 · emaLength + sumLength − 3`.

  Adds the §22.10 five-file set per primitive (impl + unit + property

  - golden + bench pair) and a conformance scenario per primitive
    under `packages/conformance/src/scenarios/`.

  Extends core's `TaNamespace` + `STATEFUL_PRIMITIVES` and the
  runtime's `RuntimeTaNamespace` + `TA_REGISTRY` accordingly. Three
  auto-generated docs pages under `docs/primitives/ta/` ship via the
  Task-2 `chartlang docs` generator.

  Provenance: ported from invinite at commit
  `078f41fe2569d659d5aba726da8bcb5d3e2ced02`. The RVI math follows
  invinite's TradingView-reference shape (EMA-smoothed up/down stddev
  arms), not the spec's draft Wilder-smoothing description.

- 38fb475: Phase-2 Task 19 — volatility ports: `ta.keltner`, `ta.envelope`, and
  `ta.chop`.

  Ships three new volatility `ta.*` primitives under
  `packages/runtime/src/ta/`:

  - `ta.keltner(opts?)` — Keltner Channels overlay envelope.
    `middle = MA(close, length, maType)` with `upper / lower =
middle ± multiplier · ATR(length)`. Defaults `length = 20`,
    `multiplier = 2`, `maType = "ema"` (TradingView / Linda Raschke
    canonical form). Composes `ta.atr` via sub-slot `${slotId}/atr`
    and the registered MA primitive (`sma` / `ema` / `wma` / `smma`)
    via sub-slot `${slotId}/<maType>` — fixes to either flow in for
    free.
  - `ta.envelope(source, opts?)` — price-percent envelope overlay.
    `middle = MA(source, length, maType)` with `upper / lower =
middle · (1 ± percent / 100)`. Defaults `length = 20`,
    `percent = 10`, `maType = "sma"`. Composes the registered MA
    primitive via sub-slot `${slotId}/<maType>` so fixes flow in
    for free.
  - `ta.chop(length, opts?)` — Choppiness Index sub-pane regime
    gauge. `chop = 100 · log10(sumTR(length) / (highest(high,
length) − lowest(low, length))) / log10(length)`, clamped to
    `[0, 100]`. High values flag sideways / choppy markets; low
    values flag strong trends. Composes `ta.highest` / `ta.lowest`
    via sub-slots; the TR-sum numerator is a sliding-window sum
    inside the slot (same internal TR math as `ta.atr`, but raw —
    Pine `ta.chop` does NOT use the Wilder-smoothed ATR).

  Each primitive ships the §22.10 set: impl + unit + property +
  golden + bench pair + conformance scenario (using the Phase-2
  `inlineSource` extension from Task 1) + auto-generated
  `docs/primitives/ta/<id>.md`. `TA_REGISTRY_METADATA.keltner` and
  `.envelope` record the multi-output hints
  (`primarySeriesKey: "middle"`,
  `visibleSeriesKeys: ["upper", "middle", "lower"]`,
  `yDomain: { kind: "auto" }`); `TA_REGISTRY_METADATA.chop` pins
  the bounded `{ yDomain: { kind: "fixed", min: 0, max: 100 } }`
  oscillator range.

  Core adds `KeltnerOpts`, `KeltnerResult`, `EnvelopeOpts`,
  `EnvelopeResult`, `ChopOpts` exports + the three `TaNamespace`
  methods. `STATEFUL_PRIMITIVES` grows by 3 (all three `slot: true`).
  `TA_REGISTRY` mirrors with the leading `slotId: string` on each
  method.

- 38fb475: Phase-2 Task 23 — volume ports `ta.chaikinOsc`, `ta.mfi`,
  `ta.netVolume`, `ta.pvo`.

  Ports four volume primitives from invinite (commit
  `078f41fe2569d659d5aba726da8bcb5d3e2ced02`) onto the chartlang
  runtime — each lands the §22.10 five-file set (impl + unit +
  property + golden + bench pair) alongside an inline conformance
  scenario and an auto-generated docs page:

  - `ta.chaikinOsc(opts?)` — Chaikin Oscillator, `EMA(ADL, fast) −
EMA(ADL, slow)`. Defaults `(3, 10)`. Composes one `ta.adl`
    sub-slot + two `ta.ema` sub-slots; a fix to either flows in for
    free. Warmup `slowLength − 1`.
  - `ta.mfi(length, opts?)` — Money Flow Index, volume-weighted RSI
    over a trailing window of typical-price comparisons. Bounded
    `[0, 100]`; emits 100 on perfect upflow, 0 on perfect downflow,
    NaN on zero total flow (invinite's zero-denominator guard).
    Warmup `length + 1`.
  - `ta.netVolume(opts?)` — cumulative `sign(close − prevClose) ·
volume`. **Math is identical to `ta.obv`** (both primitives
    exist in invinite under their own names; chartlang mirrors the
    public surface for naming parity). Property-tested for
    hash-equality against `ta.obv` over a 100-bar synthetic walk.
    Warmup 1 (bar 0 emits 0).
  - `ta.pvo(opts?)` — Percentage Volume Oscillator, MACD shape on
    `bar.volume`. Defaults `(12, 26, 9)`. Composes three `ta.ema`
    sub-slots over volume. Multi-output `{ pvo, signal, hist }`;
    `TA_REGISTRY_METADATA.pvo` records `primarySeriesKey: "pvo"`,
    `visibleSeriesKeys: ["pvo", "signal", "hist"]`, `yDomain: {
kind: "auto" }`. Warmup `slowLength + signalLength − 2`.

  Surface deltas:

  - `TaNamespace` extends with the four new methods + opts types
    (`ChaikinOscOpts`, `MfiOpts`, `NetVolumeOpts`, `PvoOpts` +
    `PvoResult`).
  - `STATEFUL_PRIMITIVES` grows by four `slot: true` entries.
  - `TA_REGISTRY` + `RuntimeTaNamespace` mirror the same delta;
    `TA_REGISTRY_METADATA.pvo` carries the multi-series metadata;
    `PHASE_1_SCENARIOS` grows by four inline scenarios.

  All four primitives carry the §16.6 100% coverage gate via their
  five-file test set; golden hashes pinned against `syntheticBars(100,
42)` (placeholder pin in the initial commit — repinned on first
  deterministic green). Per-port bench thresholds reuse the
  `THRESHOLD_MS = 300` ceiling from the existing volume primitives.

- 38fb475: Phase-2 Task 22 — volume ports `ta.obv`, `ta.adl`, `ta.bop`, `ta.cmf`.

  Ports four volume primitives from invinite (commit
  `078f41fe2569d659d5aba726da8bcb5d3e2ced02`) onto the chartlang
  runtime — each lands the §22.10 five-file set (impl + unit +
  property + golden + bench pair) alongside an inline conformance
  scenario and an auto-generated docs page:

  - `ta.obv()` — On-Balance Volume, cumulative `sign(close − prevClose) ·
volume`. Warmup 1 (bar 0 emits 0). Slot snapshots
    `prevClosedCumObv` / `prevClosedPrevClose` for tick-mode replay.
    NaN volume carries the accumulator forward without an update.
  - `ta.adl()` — Accumulation / Distribution Line, cumulative
    `((C − L) − (H − C)) / (H − L) · volume`. Warmup 0. Zero-range
    bars (`high === low`) contribute 0 (matches invinite's CLV
    guard); NaN OHLC / volume contributes 0.
  - `ta.bop()` — Balance of Power, raw per-bar `(C − O) / (H − L)`.
    Warmup 0; stateless math, output buffer only.
  - `ta.cmf(length)` — Chaikin Money Flow, trailing-window
    `Σ MFV / Σ volume`. Warmup `length − 1`; bounded `[-1, 1]`.
    Tick-mode substitutes the head slot's contribution without
    mutating the rolling window (matches `ulcerIndex`'s shape).

  Surface deltas:

  - `TaNamespace` extends with the four new methods + opts types
    (`ObvOpts`, `AdlOpts`, `BopOpts`, `CmfOpts` — each `{ offset?;
lineStyle? }`).
  - `STATEFUL_PRIMITIVES` grows by four `slot: true` entries.
  - `TA_REGISTRY` + `RuntimeTaNamespace` mirror the same delta;
    `PHASE_1_SCENARIOS` grows by four inline scenarios.

  All four primitives carry the §16.6 100% coverage gate via their
  five-file test set; golden hashes pinned against `syntheticBars(100,
42)`. Per-port bench thresholds reuse the `THRESHOLD_MS = 300`
  ceiling from the existing volume primitives.

- 38fb475: Phase-2 Task 24 — volume ports `ta.pvt`, `ta.eom`, `ta.nvi`,
  `ta.pvi`. Closes the §9.2 volume list (excluding the 4 volume-
  profile primitives deferred to Phase 5).

  Ports four volume primitives from invinite (commit
  `078f41fe2569d659d5aba726da8bcb5d3e2ced02`) onto the chartlang
  runtime — each lands the §22.10 five-file set (impl + unit +
  property + golden + bench pair) alongside an inline conformance
  scenario and an auto-generated docs page:

  - `ta.pvt(opts?)` — Price Volume Trend, cumulative `volume ·
(close − prevClose) / prevClose`. First bar emits 0;
    zero-prevClose bars emit NaN AND carry the accumulator forward;
    NaN volume contributes 0. Warmup 1.
  - `ta.eom(length, opts?)` — Ease of Movement, `length`-bar SMA of
    per-bar `((midpointMove) / boxRatio)` where `boxRatio = (volume
/ 10000) / (high − low)`. Hard-codes invinite's default divisor
    of 10000. Zero-range / zero-volume / NaN-input bars propagate
    NaN through the trailing window (forces a clean restart after
    any defective bar). Warmup `length`.
  - `ta.nvi(opts?)` — Negative Volume Index, cumulative
    close-pct-change on bars whose volume is strictly LOWER than the
    prior bar's; bars with equal-or-higher volume carry the prior
    value unchanged. Seeded at 1000 (anchor pinned by property
    test). Warmup 1.
  - `ta.pvi(opts?)` — Positive Volume Index, mirror of NVI on bars
    whose volume is strictly HIGHER than the prior bar's. Seeded at 1000. Warmup 1.

  Surface deltas:

  - `TaNamespace` extends with the four new methods + opts types
    (`PvtOpts`, `EomOpts`, `NviOpts`, `PviOpts`). All four opts
    bags share the `{ offset?: number; lineStyle?: PlotLineStyle }`
    shape.
  - `STATEFUL_PRIMITIVES` grows by four `slot: true` entries
    (86 → 90; `slot: true` count 85 → 89).
  - `TA_REGISTRY` + `RuntimeTaNamespace` mirror the same delta
    (83 → 87). No new `TA_REGISTRY_METADATA` rows — all four are
    single-output `Series<number>` with auto y-domain.
  - `PHASE_1_SCENARIOS` grows by four inline scenarios.

  All four primitives carry the §16.6 100% coverage gate via their
  five-file test set; golden hashes pinned against
  `syntheticBars(100, 42)` (placeholder pin in the initial commit —
  repinned on first deterministic green). Per-port bench thresholds
  reuse the `THRESHOLD_MS = 300` ceiling from the existing volume
  primitives.

- 38fb475: Phase-2 Task 21 — port the three foundational volume primitives:

  - **`ta.vol(opts?)`** — passthrough of `bar.volume` as a `Series<number>`.
    Warmup 0; NaN volume propagates to NaN output.
  - **`ta.vwap(opts?)`** — session-anchored VWAP keyed on the UTC
    calendar-day boundary (`floor(bar.time / 86_400_000)`). Phase 4
    lifts the session detection to `syminfo.session.regularStart` per
    invinite; until then `ta.vwap` is a UTC-day-anchored VWAP.
    Source defaults to `"hlc3"` per Pine; accepts `"close"` / `"hl2"` /
    `"ohlc4"` / `"hlcc4"`.
  - **`ta.anchoredVwap(anchorTime, opts?)`** — anchored VWAP that
    starts accumulating at the first bar with `bar.time >= anchorTime`
    and never resets. The anchor is sticky (captured on the first
    call; later anchor args are ignored). Phase 4's `input.time()`
    lifts the anchor to a runtime user input.

  All three carry the §22.10 five-file set + JSDoc with
  `@formula`/`@warmup`/`@since 0.2`/`@experimental`/`@example`; all
  register in `STATEFUL_PRIMITIVES` as `slot: true` and in
  `TA_REGISTRY` / `RuntimeTaNamespace`.

  ### `PlotOpts.style?` widening

  To exercise the Task-1 `histogram` PlotKind end-to-end on
  `ta.vol`, this PR widens the script-facing `PlotOpts` with an
  optional `style?: PlotOptsStyle` discriminated-union field
  (`{ kind: "line" }` | `{ kind: "step-line" }` |
  `{ kind: "histogram"; baseline?: number }`). The runtime's
  `plot()` impl honours the field; the canvas2d reference adapter
  dispatches `kind: "histogram"` through Task-1's `drawHistogram`
  renderer. Backward-compatible — omitting `opts.style` keeps the
  existing `kind: "line"` default.

  Future ports adding their own PlotKind (e.g. MACD-hist in Task 16,
  `bars` / `area` / `filled-band` / `label` / `marker` in their
  consumer ports) extend this same `PlotOptsStyle` union additively
  and add their dispatch arm to `createCanvas2dAdapter.applyPlot`.

  ### Conformance scenarios

  - `taVol.scenario.ts` — `plot(ta.vol(), { style: { kind: "histogram", baseline: 0 } })`.
  - `taVwap.scenario.ts` — `plot(ta.vwap({ source: "hlc3" }))`.
  - `taAnchoredVwap.scenario.ts` — `plot(ta.anchoredVwap(1_700_000_000_000))`.

  ### Provenance

  All three ports trace to `invinite/src/components/trading-chart/
indicators/{vol,vwap,anchored-vwap}.ts` at commit
  `078f41fe2569d659d5aba726da8bcb5d3e2ced02`.

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

- b0d296b: Phase-3 Task 3 — runtime `draw.*` emission infrastructure.

  **Runtime** — new `packages/runtime/src/emit/draw/` subtree:

  - `createDrawingHandle(slotId, subId, kind, initialState)` allocates
    a per-handle slot in `ctx.drawingSlots` keyed by `slotId#subId`,
    emits the first `op: "create"`, and returns a `DrawingHandle`
    whose `update(patch)` re-emits the FULL merged state under
    `op: "update"` (PLAN.md §10.3 full-state semantic) and whose
    `remove()` emits one final `op: "remove"` and flags the slot
    `removed: true`. Subsequent `update` / `remove` calls on a removed
    handle no-op. Cross-bar re-entry at the same `slotId#subId`
    resurrects the slot and emits `op: "update"`.
  - `pushDrawing(ctx, e)` enforces capability gating
    (`unsupported-drawing-kind`), wire-shape validation
    (`malformed-emission`), per-bucket budget on
    `op: "create"`/`"remove"` against
    `min(scriptMaxDrawings, adapter.maxDrawingsPerScript)`
    (`drawing-budget-exceeded`, clamped at zero on remove), and
    per-bar `(handleId, bar)` dedup (last-write-wins).
  - `nextSubId(ctx, slotId)` / `resetSubIdCounters(ctx)` —
    per-callsite per-bar counter; reset at the top of every
    `onBarClose` / `onBarTick` so iteration `i` at the same callsite
    yields the same `slotId#i` across bars.
  - `draw` re-exports core's throwing-stub Proxy verbatim. Per-kind
    Tasks 5–18 swap real impls into this seam (mirroring how the
    Phase-2 `ta` re-export switched to `TA_REGISTRY`).

  `RuntimeContext` widens with four new fields: `drawingSlots`,
  `drawingSubIdCounters`, `drawingBucketCounters`, `scriptMaxDrawings`.
  `createScriptRunner` initialises them and reads
  `compiled.manifest.maxDrawings` for the script-side cap. `dispose`
  clears the slots and resets counters.

  `buildComputeContext` now injects `draw` into the `ComputeContext`
  the runner hands the compiled script.

  **Core** — `ComputeContext.draw: DrawNamespace` field added (the
  script-facing surface). Phase-1/-2 scripts that do not consume
  `draw` keep compiling unchanged; new scripts pick up the namespace
  through the same destructure pattern as `ta` / `plot` / `hline` /
  `alert`.

  **Conformance** — `ScenarioAssertion` grows a sixth `drawing-hash`
  variant. `BufferedRun.drawings` carries the per-bar drained
  emissions; `hashDrawingSeries(drawings, handleId?)` hashes
  JSON-stringified `{ handleId, kind, op, state, bar }` tuples in
  emission order. Failure messages mirror `plot-hash`:
  `drawing-hash[<label>]: expected <pinned>, actual <computed>
(<N> emissions)` — copy `actual` to re-pin.

  No behaviour change for Phase-1/-2 scenarios — the runtime still
  emits no drawings until the per-kind ports (Tasks 5–18) land.

- Phase 4 - Editor + Inputs + Timeframes + Tier-1 Pine parity.
  Adds: input._ builders, state._ / state.tick.\* slots,
  barstate / syminfo / timeframe views, request.security typed
  surface (NaN fallback), defineIndicator overrides,
  Capabilities triad (intervals / multiTimeframe / subPanes /
  symInfoFields / maxDrawingsPerScript / alertConditions / logs),
  language-service hover registry + LSP-style API, CodeMirror 6
  editor shell + /react sub-export, Inputs UI ViewModel + React
  form. See tasks/phase-4-editor-tier1/README.md.
- Add the Phase 4 `input.*` builder namespace and typed input descriptor
  surface. `InputSchema` now carries `InputDescriptor<unknown>` values,
  and the compiler ambient shim mirrors the new core declarations so
  script type resolution stays in lockstep.
- Add the Phase 4 `state.*` and `state.tick.*` slot builder surface,
  including the `MutableSlot<T>` handle type and `ComputeContext.state`.
  The state builders are compile-time callable holes until the runtime
  slot implementation lands, and `STATEFUL_PRIMITIVES` now tracks the
  8 new slot-id-aware state builders.
- Add Phase 4 `barstate`, `syminfo`, and `timeframe` core view exports with matching `ComputeContext` types.
- Add Phase 4 script override fields to core define options and compiler manifests.
- Add the Phase 4 `request.security` core type surface and sentinel callable hole.
- Add compiler extraction for static `request.security` intervals and `requiresIntervals`, and register `request.security` for callsite slot ids.
- Resolve runtime `input.*` overrides at mount, add adapter input resolver wiring, and audit universal `ta.*` offset support.
