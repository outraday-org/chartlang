---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
---

Phase-2 Task 14 — momentum ports (`ta.pmo`, `ta.smi`, `ta.tsi`).

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
