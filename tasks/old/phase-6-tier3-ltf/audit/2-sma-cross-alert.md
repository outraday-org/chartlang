# SMA Cross Alert Audit

- Pine source shape: `ta.crossover(ta.sma(close, 9), ta.sma(close, 21))` with `alertcondition`.
- chartlang port: `defineAlertCondition` with `ta.crossover` and `signal`.
- Trace: Pine condition title/message maps to condition descriptor fields.
- Gap: none for condition-style alerts.

