---
---

canvas2d reference adapter: dispatch every wire-level `PlotStyle` kind —
`marker` (glyph band), `step-line` (stepped geometry via `drawLine`'s new
`step` arg), `area` / `filled-band` (series-shaped, accumulated into
`plotSeries`), and `label` (glyph band). The declared
`CANVAS2D_PLOT_KINDS` capability is now honest down the wire; no plot kind
silently drops. Private example package — no published bump.
