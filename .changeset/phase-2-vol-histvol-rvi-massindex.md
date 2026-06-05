---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
---

Phase-2 Task 20 — volatility ports: `ta.historicalVolatility`,
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
+ golden + bench pair) and a conformance scenario per primitive
under `packages/conformance/src/scenarios/`.

Extends core's `TaNamespace` + `STATEFUL_PRIMITIVES` and the
runtime's `RuntimeTaNamespace` + `TA_REGISTRY` accordingly. Three
auto-generated docs pages under `docs/primitives/ta/` ship via the
Task-2 `chartlang docs` generator.

Provenance: ported from invinite at commit
`078f41fe2569d659d5aba726da8bcb5d3e2ced02`. The RVI math follows
invinite's TradingView-reference shape (EMA-smoothed up/down stddev
arms), not the spec's draft Wilder-smoothing description.
