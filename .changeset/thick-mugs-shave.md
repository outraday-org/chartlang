---
"@invinite-org/chartlang-pine-converter": patch
---

Lower a typed-string `na` correctly. `na(x)` now tests the same sentinel the
declaration writes for that flavour — `x === ""` for a declared `string`,
`x === null` for a drawing handle, `!Number.isFinite(x)` for a numeric — instead
of routing every receiver through the numeric arm. `!Number.isFinite("")` is
`false` for every string, so `if not na(msg)` previously lowered to a
permanently-false `!!Number.isFinite(msg)`: the script converted, compiled and
ran, and its alert simply never fired.

The `na` vocabulary is now named once as `NaKind` (`numeric | handle | color |
string`), a `:= na` reset of a typed string emits `""` instead of poisoning the
binding with `Number.NaN`, and the receiver-derived flavour is stamped on the
`na(...)` callee node — which also makes the drawing-handle arm of the predicate
reachable for the first time.
