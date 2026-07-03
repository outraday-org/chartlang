---
---

Render `candle` / `ohlc-bar` custom OHLC series in the canvas2d reference
adapter. `plotcandle` draws a full candle per bar (high-low wick, an open-close
body colored by direction with an optional border); `plotbar` draws an OHLC bar
(vertical high-low line, left tick at open, right tick at close, up/down
colored). Both accumulate a per-bar `PlotPoint` OHLC quad and draw at flush
(the `filled-band` precedent) — the per-series body colors ride the stored
`PlotStyle` — and both opt in via `Capabilities.plots`; an all-null quad is a
gap that draws nothing. Private example package, no published bump.
