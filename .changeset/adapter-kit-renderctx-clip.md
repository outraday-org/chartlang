---
"@invinite-org/chartlang-adapter-kit": minor
---

Add `rect` + `clip` to the canvas sink's `RenderCtx` (and the shared
`MockCanvasContext` / `RecordedCall` / `hashCallLog`). Together they compose the
standard `beginPath()` → `rect()` → `clip()` idiom an adapter uses to confine a
hand-rolled `ctx` draw pass to its plotting-area box. Production
`CanvasRenderingContext2D` / `OffscreenCanvasRenderingContext2D` already satisfy
the two new members, so this is additive — every existing canvas-family caller
keeps compiling, and an adapter that never calls them paints byte-for-byte as
before (the methods are absent from all existing `hashCallLog` pins). The uPlot
reference adapter is the first consumer: it clips its candle/band/hline/drawing
overlay so off-window marks stop spilling into the axis gutters.
