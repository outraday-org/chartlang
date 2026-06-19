---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-conformance": minor
"@invinite-org/chartlang-pine-converter": minor
---

Add the `draw.fillBetween(edgeA, edgeB, opts?)` drawing primitive — a
native filled ribbon between two edges (the closed polygon `edgeA`
forward then `edgeB` reversed). It is the chartlang equivalent of Pine's
`linefill.new(line1, line2, color)` / `fill(plot1, plot2)`. The
pine-converter now lowers static two-line `linefill.new` to it instead of
approximating with `draw.rotatedRectangle`, retiring the
`linefill-rotatedrect-approximated` diagnostic.
