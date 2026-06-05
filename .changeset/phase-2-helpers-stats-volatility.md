---
"@invinite-org/chartlang-runtime": minor
---

Phase-2 Task 4 — stats / volatility / regression / pearson helpers.

Ports five new internal helpers into `packages/runtime/src/ta/lib/`:

- `donchianMid(high, low, length)` — `(max(high) + min(low)) / 2`
  over a trailing window. Consumed by `ta.donchian` (Task 18) and
  `ta.ichimoku` (Task 17).
- `wilderDirectional(high, low, close, length)` — Wilder `+DM` /
  `-DM` + `+DI` / `-DI` per bar, smoothed via `wilderStep` (reused
  from Phase-1 `lib/wilderSmoothing.ts`). Consumed by `ta.dmi` and
  `ta.adx` (Task 16).
- `adxFromDi(plusDi, minusDi, length)` — `DX = 100 * |+DI - -DI| /
  (+DI + -DI)`, Wilder-smoothed over `length`. Consumed by `ta.adx`
  (Task 16).
- `linearRegression(source, length)` — rolling OLS slope /
  intercept / value at the last bar of the window. Consumed by
  `ta.lsma` (Task 8), `ta.dpo` (Task 10), and Phase-3's
  `regressionTrend` drawing.
- `pearson(a, b, length)` — rolling Pearson correlation of two
  equal-length series, output clamped to `[-1, 1]`. Consumed by
  `ta.trendStrengthIndex` (Task 17); future Phase-5
  `correlationCoeff` shares the helper.

Each helper carries the §16.6 test set scoped to its hot-path
status: unit + property tests for all five; bench pair for
`wilderDirectional`, `linearRegression`, and `pearson`
(`donchianMid` and `adxFromDi` reduce to two Math.max/min scans
and a Wilder smooth respectively — the consumer primitive benches
in Tasks 16, 18 cover the perf surface).

All five helpers carry the 4-line provenance header pinned at
invinite commit `078f41fe2569d659d5aba726da8bcb5d3e2ced02`.
