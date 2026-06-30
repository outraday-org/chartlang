---
"@invinite-org/chartlang-compiler": patch
---

Size ring-buffer capacity for indicators inside `request.security` expression callbacks. `extractMaxLookback` now counts a `ta.*` indicator's literal length (e.g. `ta.rsi(b.close, 14)`) when the call is inside a `request.security({ interval }, (b) => …)` callback, so the secondary stream retains enough history to warm that indicator. Previously the manifest sized capacity only from the main body, collapsing a no-lookback script to a 1-bar secondary buffer — under the production bulk-warm feed (the secondary stream is warmed before the script's first compute captures the callback) the warmup window was evicted and the cross-timeframe indicator filter read NaN forever, so the alert silently never fired. The contribution is bounded by the same 5000-slot ceiling as the dynamic-index fallback; main-clock indicators (which self-warm via scalar slot state) are unaffected.
