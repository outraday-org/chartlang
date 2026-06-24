---
"@invinite-org/chartlang-adapter-kit": minor
---

Add `bezierCurveTo` to the canvas sink's `RenderCtx` (and the shared
`MockCanvasContext` / `RecordedCall` / `canonicalise`). A self-scaled canvas
adapter uses it to stroke a smooth curve through a plot series' points instead
of straight segments. Production `CanvasRenderingContext2D` /
`OffscreenCanvasRenderingContext2D` already satisfy the new member, so this is
additive — every existing canvas-family caller keeps compiling, and an adapter
that never calls it paints byte-for-byte as before (the method is absent from
all existing `hashCallLog` pins).

This backs default plot-line smoothing in the reference adapters: plain `line`
plots now render as a smooth curve (monotone-cubic in the canvas2d reference;
each library adapter uses its native smoothing — konva `tension`, echarts
`smooth`, uPlot spline paths, lightweight-charts `lineType: Curved`) so a
moving-average line reads as a curve rather than a faceted polyline at dense bar
spacing. Step-lines and area edges stay straight.
