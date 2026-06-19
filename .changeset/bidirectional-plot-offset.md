---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-pine-converter": minor
"@invinite-org/chartlang-conformance": patch
---

Bidirectional plot `offset` — negative offsets shift a plotted series left.

`offset` becomes a presentation-only **display shift** in bars with the
fixed sign convention `+n` = right (future), `−n` = left (past); the
numeric series value is unshifted. This replaces the old value-read model
(where a positive offset made `series.current` read the value N bars ago
and a negative offset resolved to `NaN`). The `*Opts` `offset` JSDoc (and
ALMA's `barShift`) now describe both directions and drop the old
"negative ⇒ NaN" wording (`AlmaOpts.offset`, the Gaussian-centre
position, is unchanged).

`PlotEmission` gains an optional presentation field `xShift?: number`
(signed integer bars; omitted/`0` ≡ no shift, so a no-shift emission is
byte-identical to today). `validateEmission` rejects a non-integer
`xShift`. The compiler no longer counts `offset` toward `maxLookback`
(the value is no longer read from a deeper slot). The runtime threads the
declared offset onto the emission as `xShift` (reading a
`WeakMap<Series, number>` offset tag set by `makeShiftedSeriesView`; ALMA
tags `opts.barShift`) and stops the old value-read shift so
`series.current` is unshifted; the reference adapter renders it by
projecting `xShift` onto the x-axis (extending the viewport for
future-shifted points).

The Pine converter now maps `plot(<ta.* call>, offset=N)` onto the
emitted `ta.*` call's `offset` opt (signed, both directions); a plot
whose value is not a direct `ta.*` call drops the offset and emits the
new `plot-offset-needs-ta-call` warning, and a plot-level offset
replacing the ta call's own `offset=` emits `plot-offset-overrides-ta-offset`.

The conformance harness's `plot-field` assertion gains an `xShift` field,
and a new scenario pins both shift directions plus the unshifted value
series.
