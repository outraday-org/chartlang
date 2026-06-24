---
"@invinite-org/chartlang-adapter-kit": minor
---

Two rendering fixes for the self-scaled adapters.

**Viewport no longer snaps to fit-all on the first interaction.** The shared
`createViewController` now seeds the held window from the window last returned by
`resolveXWindow` (what the user is currently looking at — the framed
`initialVisibleBars` view) on the first `zoomAt`/`panBy`, instead of from the full
data range. Previously the first wheel/drag discarded the framed window and
snapped the chart back to all bars; now leaving auto-follow zooms smoothly from
the current view. It falls back to the data bounds only when nothing has rendered
yet, so the interact-before-first-render path is unchanged.

**Add `setTransform` to the canvas sink's `RenderCtx`** (and the shared
`MockCanvasContext` / `RecordedCall` / `canonicalise`). This lets a self-scaled
canvas adapter apply an ambient `setTransform(dpr, 0, 0, dpr, 0, 0)` and draw in
CSS-pixel space, so absolute sizes (line widths, fonts) render at their intended
thickness on a HiDPI backing store instead of a half-thick, edgy hairline.
Production `CanvasRenderingContext2D` / `OffscreenCanvasRenderingContext2D`
already satisfy the new member, so this is additive — every existing
canvas-family caller keeps compiling, and an adapter that never calls it (e.g.
at `dpr === 1`) paints byte-for-byte as before (the method is absent from all
existing `hashCallLog` pins). The canvas2d reference adapter is the first
consumer.
