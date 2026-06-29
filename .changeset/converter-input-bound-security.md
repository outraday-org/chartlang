---
"@invinite-org/chartlang-pine-converter": minor
"@invinite-org/chartlang-compiler": patch
---

Map input-bound `request.security` symbol/timeframe feeds,
`input.timeframe`→`input.interval` (incl. chart timeframe), and the `gaps=`
argument.

The converter now resolves a `request.security` symbol/timeframe bound to an
`input.symbol` / `input.timeframe` declaration through that input and emits the
chartlang `inputs.<name>` reference (so the value stays user-editable), instead
of rejecting it with `request-security-not-mapped`. `input.timeframe` maps to
`input.interval`, and an empty `input.timeframe("")` default is the chart
timeframe (`input.interval("")`) rather than a spurious
`non-literal-input-default`. The tuple/list output form shares the same
resolution. A `gaps = barmerge.gaps_off|gaps_on` argument is recognised and
dropped with one `request-security-gaps-dropped` info (chartlang feeds are
gap-filled by default) instead of an unmapped-arg error. A computed / wrong-axis
symbol or timeframe still rejects with `request-security-not-mapped`.

`compiler`: the `request.security` feed extractor (`getInputDefault` /
`getInputsEnumOptions`) now unwraps enclosing parentheses + `as` casts, so the
converter's `inputs.<name> as string` feed emit — the cast is required because a
script's `compute` `inputs` is typed `Record<string, unknown>` — resolves to the
input default. A hand-written un-cast `inputs.<name>` is unchanged.
