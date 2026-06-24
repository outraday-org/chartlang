---
---

konva example adapter: honour `bar-color` `colorValue` (3-state: omitted ⇒
static, present ⇒ override, `null` ⇒ no tint), colour `candle-override`
bodies by bar direction (bull/bear/doji), render `marker` / `shape` with real
per-shape glyph geometry (all eight shapes via one shared `shapeGlyphNodes`
helper, honouring `shape.location`), and fold drawings into a single per-pane
z-sorted paint pass driven by the shared `sortByRenderOrder` / `RENDER_BAND`
(a `z:-1` drawing sinks below a `z:0` plot; a `z:1` plot lifts above a
drawing). Private example package — no published version bump.
