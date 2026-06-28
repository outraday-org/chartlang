# @invinite-org/chartlang-examples

## 0.1.0

### Minor Changes

- 52f6192: New published package `@invinite-org/chartlang-examples`: the chartlang
  example catalogue as a typed data surface. Exports `EXAMPLE_CATALOGUE`
  (`ReadonlyArray<ExampleMetaWithSource>` — every example's metadata plus its
  inlined `.chart.ts` source, the same payload as `examples/catalogue.json`),
  the `ExampleCategory` / `CATEGORY_LABELS` / `CATEGORY_ORDER` taxonomy, and the
  `ExampleMeta` / `ExampleMetaWithSource` types. The data module
  (`src/catalogue.generated.ts`) is generated from `examples/catalogue.ts` by
  `pnpm examples:generate` and byte-diff-gated by `pnpm examples:gate`, so it can
  never drift from the source catalogue. Downstream repos (invinite) consume this
  to regenerate their chartlang template dialog from the canonical catalogue.

### Patch Changes

- 52f6192: Finalize full primitive coverage and flip the coverage gate to fully
  enforcing.

  - Close the last two uncovered primitives with `crossover-signal`
    (`ta.crossover`) and `crossunder-signal` (`ta.crossunder`) defaults in the
    `ta-pivots-utility` category. The catalogue now covers **every** primitive
    (200 doc pages, 200 covered) across 229 example entries, plus 15 language
    idioms via the separate `examples:idioms` gate.
  - `pnpm examples:coverage` (`scripts/examples-coverage.ts`) now enforces
    `target ⊆ covered` exactly with **no allowlist** — `examples/coverage-allowlist.json`
    is deleted, so any future `docs/primitives/**` page without an example is a
    hard CI failure. Dropped the allowlist read and the `STALE_ALLOWLIST` branch
    (and the corresponding helper tests).

- 52f6192: Add `define-bar-context` example scripts covering the `define.*` overrides
  (`format`, `maxBarsBack`, `precision`, `requiresIntervals`, `scale`,
  `shortName`), the read-only context views (`barstate`, `timeframe`,
  `session`), and `request.lowerTf`.
- 52f6192: Add `draw-channels` example scripts: one runnable `.chart.ts` per channel,
  regression, and cycle `draw.*` kind — `draw.disjointChannel`,
  `draw.trendChannel`, `draw.regressionTrend`, `draw.flatTopBottom`,
  `draw.pitchfork`, `draw.pitchfan`, `draw.cyclicLines`, and `draw.timeCycles`
  — with a matching `draw-channels` catalogue fragment crediting each primitive.
- 52f6192: Add the Draw · Elliott Waves example family: one runnable `.chart.ts` demo per
  Elliott-wave `draw.*` kind (`elliottImpulseWave`, `elliottCorrectionWave`,
  `elliottTriangleWave`, `elliottDoubleCombo`, `elliottTripleCombo`), each
  anchoring its ordered wave pivots to real recent bars via `bar.point` offsets,
  plus the matching `draw-elliott` catalogue fragment.
- 52f6192: Add `draw-fibonacci` example scripts: one runnable `.chart.ts` per uncovered
  Fibonacci `draw.*` kind — `draw.fibChannel`, `draw.fibCircles`,
  `draw.fibSpeedArcs`, `draw.fibSpeedFan`, `draw.fibSpiral`, `draw.fibTimeZone`,
  `draw.fibTrendExtension`, `draw.fibTrendTime`, and `draw.fibWedge` — each
  anchored on a tracked `ta.pivotsHighLow` swing leg via `bar.point`, with a
  matching `draw-fibonacci` catalogue fragment crediting each primitive
  (`draw.fibRetracement` is already covered by the migrated `fib-retracement`
  example).
- 52f6192: Add one runnable example per Gann `draw.*` kind (`gann-box`, `gann-fan`,
  `gann-square`, `gann-square-fixed`) under the `draw-gann` category, each
  anchored on a tracked `ta.pivotsHighLow` swing via `bar.point`, and credit
  their primitives so the coverage allowlist can shrink.
- 52f6192: Add `draw-lines` example scripts: one runnable `.chart.ts` per uncovered
  line/ray `draw.*` kind — `draw.arrow` (`pivot-arrow`), `draw.horizontalLine`
  (`swing-high-level`), `draw.verticalLine` (`cross-event-marker`),
  `draw.crossLine` (`pivot-crosshair`), `draw.trendAngle` (`trend-angle-slope`),
  `draw.sineLine` (`sine-wave-cycle`), `draw.polyline` (`pivot-polyline`), and
  `draw.path` (`swing-path`) — each anchored via `bar.point` / tracked `state.*`
  swing points and reusing one drawing handle, with a matching `draw-lines`
  catalogue fragment crediting each primitive. `draw.line`, `draw.horizontalRay`,
  and `draw.fillBetween` are already covered by migrated defaults and are skipped.
- 52f6192: Add the `draw-markers` example family: one runnable `.chart.ts` per
  marker / annotation / table `draw.*` kind — `event-marker`
  (`draw.marker`), `pivot-arrow-marker` (`draw.arrowMarker`),
  `swing-low-buy-arrow` (`draw.arrowMarkUp`), `swing-high-sell-arrow`
  (`draw.arrowMarkDown`), `last-price-callout` (`draw.text`), `stats-table`
  (`draw.table`), and `grouped-line-label` (`draw.group`) — plus the
  `examples/catalogue/draw-markers.ts` fragment crediting each primitive.
- 52f6192: Add one runnable example per harmonic / chart-pattern `draw.*` kind
  (`abcd-pattern`, `cypher-pattern`, `xabcd-pattern`, `three-drives-pattern`,
  `head-and-shoulders`, `triangle-pattern`) under the `draw-patterns` category,
  each laid out in its kind's exact labelled point order and time-anchored at
  fixed bar offsets via `bar.point` (scaled to a 1%-of-price unit), and credit
  their primitives so the coverage allowlist can shrink. This completes `draw.*`
  coverage.
- 52f6192: Add one runnable example per shape / freehand `draw.*` kind under the
  `draw-shapes` category — `draw.circle`, `draw.ellipse`, `draw.arc`,
  `draw.rectangle`, `draw.rotatedRectangle`, `draw.triangle`, `draw.frame`,
  `draw.curve`, `draw.doubleCurve`, `draw.brush`, `draw.pen`, and
  `draw.highlighter` — each anchored over a recent window via `bar.point`
  and reusing one drawing handle, and credit their primitives so the
  coverage allowlist can shrink by these ids.
- 52f6192: Add one runnable example per `input.*` builder (category `inputs`): `input.int`,
  `input.float`, `input.bool`, `input.string`, `input.enum`, `input.color`,
  `input.source`, `input.interval`, `input.price`, `input.time`, `input.symbol`,
  and `input.externalSeries`. Each renders meaningfully at its default value
  (the demo has no input-override UI).
- 52f6192: Add the `language` example category — 15 single-concept **language idiom**
  examples ("how you express X", not "which primitive exists"): series indexing
  (`.current`/`[n]`/`.length`, direct `bar.close[1]`, bidirectional `ta` `offset`,
  warmup NaN gaps, bounded-loop windows, `bar.point` anchors), indicator
  composition (`<dep>.output`, `.withInputs`, multi-export files, cross-file
  imports), pane routing, `apiVersion: 1` version pinning, and the
  `defineDrawing` / `defineAlert` / `defineAlertCondition` script kinds.

  These are keyed to a new `examples/idiom-manifest.json` + a dedicated
  `pnpm examples:idioms` gate (orthogonal to the per-primitive
  `examples:coverage` gate — they do not appear in `coverage-allowlist.json`).
  `ExampleMeta` and the generated `DemoScript` gain an optional
  `idioms?: ReadonlyArray<string>` field, set only on `language` entries; the
  published catalogue now carries the `language` category + `idioms` (flag for
  the invinite taxonomy sync). The CLI e2e compile loop is now kind-aware so the
  non-indicator idiom scripts are covered.

- 52f6192: Add worked examples for the state / plot / hline family — one
  single-primitive default per uncovered id in the `state-plot-alert`
  category: `state.int` (bar-counter), `state.float` (running-max-close),
  `state.bool` (cross-latch), `state.string` (last-signal-label),
  `state.tick.int` (tick-count), `state.tick.float` (tick-running-sum),
  `state.tick.bool` (tick-latch), `state.tick.string` (tick-last-event),
  `plot` (plot-styled, the multi-option line surface), and `hline`
  (hline-guides, two oscillator guides). The `state.*` demos mutate a
  persistent slot per bar so cross-bar persistence is observable; the
  `state.tick.*` demos document their intrabar `varip` semantics (visually
  identical on the confirmed-bar demo feed).
- 52f6192: Add bands, channels & volatility examples (`ta-bands-volatility`
  category): Keltner Channel, Donchian Channel, MA Envelope, Bollinger
  Bandwidth, Bollinger %B, Average True Range, Average Daily Range, Rolling
  Std Dev, Historical Volatility, Ulcer Index, and Mass Index — one
  runnable example per `ta.*` band/channel/volatility primitive.
- 52f6192: Add worked examples for the first batch of momentum oscillators
  (`ta.stochRsi`, `ta.stoch`, `ta.smi`, `ta.williamsR`, `ta.cci`,
  `ta.cmo`, `ta.momentum`, `ta.roc`, `ta.tsi`), each a single-primitive
  default in the `ta-momentum` category.
- 52f6192: Add momentum/cycle oscillator examples (TA · Momentum II): one runnable
  `examples/scripts/<id>.chart.ts` per primitive — `ta.macd`, `ta.ppo`,
  `ta.pvo`, `ta.ao`, `ta.bop`, `ta.fisher`, `ta.connorsRsi`, `ta.coppock`,
  `ta.kst`, `ta.pmo`, `ta.trix`, `ta.rvi`, `ta.rvgi`, `ta.dpo`,
  `ta.ultimateOsc`, `ta.chop`, and `ta.trendStrengthIndex` — plus the
  `ta-momentum-ii` catalogue fragment crediting each.
- 52f6192: Add worked examples for the moving-average overlays (`ta.wma`,
  `ta.hma`, `ta.dema`, `ta.tema`, `ta.smma`, `ta.vwma`, `ta.alma`,
  `ta.kama`, `ta.lsma`, `ta.mcginley`, `ta.maRibbon`), each a
  single-primitive default in the `ta-moving-averages` category.
- 52f6192: Add worked examples for the pivots, fractals & series-utility helpers
  (`ta.pivotsStandard`, `ta.williamsFractal`, `ta.zigZag`, `ta.highest`,
  `ta.lowest`, `ta.highestbars`, `ta.lowestbars`, `ta.barssince`,
  `ta.valuewhen`, `ta.change`, `ta.median`, `ta.nz`), each a
  single-primitive default in the `ta-pivots-utility` category.
- 52f6192: Add the trend / directional / trailing-stop example scripts and the
  `ta-trend` catalogue fragment.

  - One runnable `examples/scripts/<id>.chart.ts` per trend/directional
    primitive: `ta.ichimoku` (ichimoku-cloud), `ta.adx`
    (adx-trend-strength), `ta.dmi` (dmi-directional), `ta.aroon`
    (aroon-up-down), `ta.aroonOsc` (aroon-oscillator), `ta.psar`
    (parabolic-sar), `ta.supertrend` (supertrend), `ta.vortex`
    (vortex-indicator), `ta.chandeKrollStop` (chande-kroll-stop),
    `ta.volatilityStop` (volatility-stop), and `ta.chandelier`
    (chandelier-exit).
  - Add `examples/catalogue/ta-trend.ts` crediting each primitive under
    the `ta-trend` category.

- 52f6192: Add worked examples for the volume-profile primitives
  (`ta.anchoredVolumeProfile`, `ta.fixedRangeVolumeProfile`,
  `ta.sessionVolumeProfile`, `ta.visibleRangeVolumeProfile`), each a
  single-primitive default in the `ta-volume-profile` category that plots
  the profile's point of control over its range anchor.
- 52f6192: Add the TA · Volume & Flow example set (`ta-volume` category). One runnable
  `examples/scripts/<id>.chart.ts` per volume / money-flow primitive — `ta.obv`, `ta.vwap`, `ta.anchoredVwap`, `ta.cmf`,
  `ta.mfi`, `ta.eom`, `ta.nvi`, `ta.pvi`, `ta.pvt`, `ta.klinger`,
  `ta.chaikinOsc`, `ta.adl`, `ta.netVolume`, and `ta.vol` — plus the
  `examples/catalogue/ta-volume.ts` fragment crediting each id for the coverage
  gate.
