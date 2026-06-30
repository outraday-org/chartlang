---
"@invinite-org/chartlang-pine-converter": minor
---

History-promote a top-level `=`-declared local whose value is rooted in a bare
OHLCV builtin (`chg = (close - close[1]) / close[1] * 100` then `chg[1]`). The
A1 promotion resolver now applies the `BUILTIN_SYMBOLS` fallback, so such a
series-qualified, history-indexed local lowers to an indexable `state.series`
slot instead of a plain `let` (which made `chg[1]` index a `number`).
