# @invinite-org/chartlang-alert-runner

## 1.1.0

### Minor Changes

- 929ce60: Script chains in the alert runner.

  - `createAlertRunner({ externalSeries: { names } })` feeds the listed
    `input.externalSeries` inputs, by manifest input entry key (translated to
    the descriptor `name`): `warmUp(bars, { externalSeries: { key: number[] } })`
    aligned to the warm-up bars, `onBarClose(bar, { externalSeries: { key: v } })`
    one value per bar (missing / non-finite = `NaN`, a watermark-skipped bar
    appends nothing) and `onPreClose(bar, offsetMs, { externalSeries })` for the
    forming bar (copy only; a lossy replay re-sends each bar's values). Values
    go in as one-value offset windows, never the history (flat cost per bar).
    Unlisted external-series inputs are still refused with the 1.0 text.
    `validateAlertInputs(manifest, inputs, { externalSeries })` applies the
    same rule (and refuses two fed keys sharing one descriptor name). A
    warm-up array may hold up to `max(5,000, capabilities.maxLookback)`
    values; an unexpected host error fails a runner that feeds external
    series.
  - `createSeriesRunner({ ...opts, plotSlots })` — a producer sharing the
    runner core: `warmUp` → `{ plots: { slotId: number[] } }`, `onBarClose` →
    `{ folded, events, plots: { slotId: number } }`, `onPreClose` → the
    pre-close result plus `plots`. Unknown / duplicate / empty slots throw
    `"invalid-argument"`.
  - A runner that feeds external series is `"lossy"`
    (`snapshotFidelityOf(compiled, { externalSeries: true })`): no snapshot
    export, rebuild by warm-up.

  `AlertRunner`'s 1.0 return types are unchanged.

### Patch Changes

- Updated dependencies [929ce60]
- Updated dependencies [929ce60]
  - @invinite-org/chartlang-core@1.15.0
  - @invinite-org/chartlang-host-quickjs@1.9.0

## 1.0.0

### Major Changes

- 7206272: New package `@invinite-org/chartlang-alert-runner` 1.0.0: a headless alert evaluator for compiled chartlang
  scripts. `createAlertRunner({ compiled, symInfo, interval, inputs, frequency, limits, snapshot })` runs the script in
  the QuickJS sandbox and offers `warmUp(history)`, `onBarClose(bar)` → alert events, `onSecondaryBarClose`,
  `onPreClose(bar, offsetMs)` (evaluates the forming bar on a copy of the state), and `exportSnapshot()` (a JSON
  document keyed on every spec persistent-store identity field plus the inputs). Frequencies `once`, `once_per_bar`,
  `once_per_bar_close` and `every_time` (+ `cooldownBars`); stable `dedupeKey`s built on the bar time; strict input
  validation; `requiredHistory()` from the manifest; a budget abort fails the runner closed. Scripts whose state a
  runtime snapshot cannot carry (`snapshotFidelityOf` → `"lossy"`, e.g. `ta.crossover`) never export a snapshot and
  evaluate pre-close by replay. Also `createBarAggregator` (ticks / 1m bars → interval bars), `createFrequencyGate`,
  `validateAlertInputs`, `alertRunnerCapabilities`. Runs inside `node:worker_threads`; see `docs/hosts/alert-runner.md`.

### Patch Changes

- Updated dependencies [7206272]
  - @invinite-org/chartlang-host-quickjs@1.8.0
