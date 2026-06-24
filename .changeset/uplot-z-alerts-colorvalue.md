---
---

uplot adapter: wire z render-order through the shared `sortByRenderOrder` +
`RENDER_BAND` (hook-painted glyphs / horizontal-histograms / hlines / drawings
fully z-sorted among themselves; native uPlot series remain beneath the hook —
the documented native-vs-hook bound), render the declared `alertConditions` +
`logs` via the canvas draw-hook overlay (always-on-top, mirroring the canvas2d
reference), and honour line-family `colorValue` as a whole-series stroke
override (the uplot structural bound — uPlot paints each series from one
stroke). Private example package; no published-API change.
