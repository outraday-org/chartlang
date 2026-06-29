---
"@invinite-org/chartlang-runtime": patch
"@invinite-org/chartlang-conformance": patch
---

Resolve Pine's empty-interval idiom (`request.security({ interval: "" })`) to the
chart's own timeframe instead of all-NaN. An empty interval combined with the
chart symbol is "the chart's own clock" (Pine's
`request.security(syminfo.tickerid, "", x)`), which on TradingView simply returns
the chart's own series. `makeSecurityBar` now short-circuits the
`symbol === undefined && interval === ""` case to a `SecurityBar` view over the
MAIN stream's own series — reusing the stream's O(1) head-relative views — BEFORE
the symbol / `multiTimeframe` / `unsupported-interval` / secondary-stream gates,
so it needs no adapter capability and no registered secondary feed. A different
symbol at `interval: ""` is unchanged (it stays the `multiSymbol` secondary path,
NaN when unsupported), and a non-empty interval still flows through the secondary
alignment path. Adds the `empty-interval-passthrough` conformance scenario proving
the passthrough close is byte-identical to a direct `bar.close` plot under
`multiTimeframe: false`. The expression form (`request.security({ interval: "" },
expr)`) is unchanged: the compiler treats the chart timeframe as the main clock
(no HTF expression unit), so its callsite routes into the same data-form
passthrough.
