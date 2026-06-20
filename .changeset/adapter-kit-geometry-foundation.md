---
"@invinite-org/chartlang-adapter-kit": minor
---

Add a renderer-agnostic geometry layer to `adapter-kit`: the `Viewport` +
projection helpers (`timeToX`, `priceToY`, `worldPointToPixel`), the
`DrawPrimitive` IR (`polyline` / `arc` / `text` / `marker` with `StrokeStyle` /
`FillStyle`), and `decomposeDrawing(emission, viewport)` covering the 20 basic
drawing kinds (lines / rays, boxes / shapes incl. `fill-between`, annotations,
marker, text). The remaining 43 kinds return `[]` until Tasks 2–3 land their
decomposers.

Also ships the canvas-family sink under the new `./canvas` sub-path:
`RenderCtx`, `paintPrimitive(ctx, prim)`, the generalised `MockCanvasContext`
(records every method + setter), and `hashCallLog` for deterministic call-log
hashing.
