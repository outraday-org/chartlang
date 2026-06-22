---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-host-worker": minor
"@invinite-org/chartlang-host-quickjs": minor
"@invinite-org/chartlang-pine-converter": minor
"@invinite-org/chartlang-cli": patch
"@invinite-org/chartlang-conformance": patch
---

Add multi-symbol support to `request.security`. `request.security({ symbol,
interval })` now reads a **different instrument** (not just a higher
timeframe), e.g. `request.security({ symbol: "AMEX:SPY", interval: "1D" })`.
`symbol` is optional (defaults to the chart symbol) and must be a compile-time
literal (`input.symbol` / `input.enum` resolved). A new `multiSymbol` adapter
capability gates non-chart-symbol requests: a different-symbol request against
an adapter declaring `multiSymbol: false` degrades to an all-NaN
bar/series with a single deduped `multi-symbol-not-supported` diagnostic,
mirroring `multi-timeframe-not-supported` (the symbol gate precedes the
timeframe gate, so a both-different request emits only the symbol diagnostic).
The Pine converter now lowers `request.security("OTHER", tf, expr)`, and the
`chartlang scaffold-adapter` template advertises `multiSymbol`.
