---
---

Fix the ECharts reference adapter dropping the universal plot `offset`
(`PlotEmission.xShift`) on multi-plot scripts, and bring its candle look +
double-click reset into parity with the canvas2d reference. ECharts is the
category/index rendering model, so each stored series point now renders at its
shifted category column (`shiftedBarIndex(bar, xShift)` from adapter-kit): a
`+k` point lands in one of the synthetic future categories `buildOption`
appends (`lastTime + k · medianBarSpacing(bars)`, extending the axis by the max
positive shift across all series), an in-range `−k` writes at `bar − k`, and a
negative index is clipped (no negative category). Line / step-line / area /
histogram / filled-band / glyph series all honour the shift; the candlestick +
bg/bar `markArea` keep their real bar indices. A no-offset frame is
byte-identical to the pre-offset build (max shift `0` ⇒ axis unchanged), so the
EMA-cross integration golden is unaffected by the offset path. Separately, the
candlestick now carries explicit bull `#26a69a` / bear `#ef5350` body colours
(matching canvas2d, replacing ECharts' stock red/green — this deliberately
re-pinned the integration `PINNED_HASH`), and a `chart.on("dblclick", …)`
resets the inside-`dataZoom` window to the full range, wired through a new
optional `EChartsSurface.on` seam that `MockECharts` exercises headlessly via
`fire(...)`. (Private example package; no published surface — empty changeset.)
