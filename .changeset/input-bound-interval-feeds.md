---
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-core": minor
---

Accept input-bound and chart-timeframe intervals as compile-time security feeds.

The compiler's `request.security` feed extraction now reads an `interval` bound
to an `input.interval` default (via the shared `getInputDefault` helper), exactly
as it already reads an `input.symbol` default for the `symbol` axis — reversing
the previous "an `input.interval` is never a feed interval" rule. An empty
default (`""`, Pine's chart timeframe) resolves to the chart interval: a
chart-symbol + chart-timeframe pair collapses onto the primary stream (no feed,
no `requestedIntervals` entry), while a present-symbol + chart-timeframe pair
stays a distinct `{ symbol, interval: "" }` feed. The expression-form descriptor
anchor mirrors the same `input.interval`-default acceptance. A genuinely-dynamic
interval still rejects with `request-security-interval-not-literal`.

`core`: relaxed the `RequestSecurityOpts.interval` literal-only JSDoc to document
the `input.interval` default + chart-timeframe (`""`) cases.
