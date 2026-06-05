---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
---

Phase-2 Task 11 — oscillator ports: `ta.stochRsi`, `ta.ultimateOsc`,
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
+ bench pair + conformance scenario (inlined per Task 1) +
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
