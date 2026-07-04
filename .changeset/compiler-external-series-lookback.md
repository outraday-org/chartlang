---
"@invinite-org/chartlang-compiler": patch
---

Size history lookback for same-chart external-series input reads. An element
access of an `input.externalSeries` value — `const bound = inputs.bound;
bound[N]`, a destructured `const { bound } = inputs; bound[N]`, or a direct
`inputs.bound[N]` / `inputs["bound"][N]` — now folds into `maxLookback`
(literal index) or trips the
`dynamicFallback` safety net (non-literal index), exactly like an OHLCV
`bar.close[N]` read. Previously such reads were unsized, collapsing the runtime
ring buffer to the OHLCV-derived capacity (often 1) so a deep read returned
`NaN`.

Passing an external series to a `ta.*` builtin (`ta.sma(bound, len)`) is
deliberately NOT sized: the primitive reads only the source's `.current` and
buffers its own window, so it needs no extra source capacity regardless of the
length being literal or dynamic.
