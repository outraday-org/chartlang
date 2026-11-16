---
"@invinite-org/chartlang-alert-runner": major
---

New package `@invinite-org/chartlang-alert-runner` 1.0.0: a headless alert evaluator for compiled chartlang
scripts. `createAlertRunner({ compiled, symInfo, interval, inputs, frequency, limits, snapshot })` runs the script in
the QuickJS sandbox and offers `warmUp(history)`, `onBarClose(bar)` → alert events, `onSecondaryBarClose`,
`onPreClose(bar, offsetMs)` (evaluates the forming bar on a copy of the state), and `exportSnapshot()` (a JSON
document keyed on every spec persistent-store identity field plus the inputs). Frequencies `once`, `once_per_bar`,
`once_per_bar_close` and `every_time` (+ `cooldownBars`); stable `dedupeKey`s built on the bar time; strict input
validation; `requiredHistory()` from the manifest; a budget abort fails the runner closed. Scripts whose state a
runtime snapshot cannot carry (`snapshotFidelityOf` → `"lossy"`, e.g. `ta.crossover`) never export a snapshot and
evaluate pre-close by replay. Also `createBarAggregator` (ticks / 1m bars → interval bars), `createFrequencyGate`,
`validateAlertInputs`, `alertRunnerCapabilities`. Runs inside `node:worker_threads`; see `docs/hosts/alert-runner.md`.
