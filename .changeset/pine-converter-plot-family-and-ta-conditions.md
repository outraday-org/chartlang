---
"@invinite-org/chartlang-pine-converter": patch
---

Broaden the plot-family and `ta.*` lowering: `plotshape`/`plotchar`/`plotarrow`
map `location`/`style`/`char` enums, `ta.pivothigh`/`ta.pivotlow` project the
`ta.pivotsHighLow` result fields, `input.*` reads carry an `as <type>` cast,
generic type annotations (`array<line>`) parse, a standalone `polyline.new`
lowers, and a fully-dead `if` (all branches owned-drawing-only) is dropped. A
`ta.*` boolean used directly as a `plotshape`/`plotchar`/`plotarrow` condition
now lowers with `.current` so the shape gates on the per-bar scalar instead of a
perpetually-truthy `Series` object. New fixtures 21–24 exercise the SMA overlay,
ATR pane, RSI bands, and EMA-cross conversions through the compile round-trip
gate.
