---
"@invinite-org/chartlang-conformance": patch
---

Add dedicated `ta.*` conformance scenarios for the nine Phase-1 primitives (`atr`, `bb`, `crossover`, `crossunder`, `ema`, `macd`, `rsi`, `sma`, `stdev`). Each primitive was previously only exercised indirectly via the cross-cutting `EMA_CROSS_SCENARIO`, `BOLLINGER_BANDS_SCENARIO`, and `RSI_DIVERGENCE_SCENARIO`; the §22.10 contract expects one dedicated scenario per primitive. `ALL_SCENARIOS` grows by 9 (211 → 220) and the canvas2d adapter report is regenerated accordingly.
