---
"@invinite-org/chartlang-core": minor
---

Widen `ta.*` numeric source parameters to `number | Series<number>`
(`TaSource`) to match the runtime, which already accepts a per-bar scalar.
A computed source like `ta.ema((ma - ma[1]) / ma[1] * 100, n)` now
type-checks — no `state.series` wrapper required.
