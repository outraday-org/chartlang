---
---

Paint the five glyph plot kinds the uPlot reference adapter buffered but never
drew — `shape` / `character` / `arrow` / `marker` / `label` — in the overlay
`hooks.draw` ctx pass, consuming the newly shared
`@invinite-org/chartlang-adapter-kit/canvas` glyph geometry (`drawShape` /
`drawCharacter` / `drawArrow` / `drawMarker` / `drawLabel`) rather than
re-deriving it. Each glyph anchors at its plot's SHIFTED x
(`timeToX(shiftedBarTime(...))` — the same `xShift` funnel the native series
use — folded with the plotting-area `dx` offset) and `value` → y; a non-finite
`value` is a per-glyph skip. Glyphs paint inside the existing bbox clip, after
the candles/volume-profile, in declaration order (Task 10 wires the z sort). An
empty / all-non-glyph overlay set adds no ctx calls, so a glyph-free script
keeps the candle/hline/drawing hash byte-identical. Private example package — no
published surface; empty changeset.
