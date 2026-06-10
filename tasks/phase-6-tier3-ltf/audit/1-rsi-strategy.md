# RSI Strategy Audit

- Pine source shape: RSI threshold script using `strategy.entry`.
- chartlang port: indicator with `ta.rsi` and `plot`.
- Trace: `strategy.entry` has no 0.6 equivalent; emit plots/alerts instead.
- Gap: strategy order execution is not supported.

