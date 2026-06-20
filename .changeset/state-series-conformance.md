---
"@invinite-org/chartlang-conformance": patch
---

Add the `state-series-history` and `pine-converter-round-trip-var-series`
conformance scenarios.

`state-series-history` republishes `bar.close` through a user `state.series`
(`s.value = bar.close.current` each bar) and pins `s[2]` byte-identical to a
direct `bar.close[2]` read (warmup `NaN`s included), locking the runtime
`state.series` slot's advance/commit discipline into the cross-adapter suite.

`pine-converter-round-trip-var-series` converts the `30-var-series-history`
fixture (`var float prev = na` read with `prev[1]`) at module load and pins
both plots over the full emission stream — the end-to-end proof that the
history-indexed `var` → `state.series` lowering survives convert → compile →
runtime.
