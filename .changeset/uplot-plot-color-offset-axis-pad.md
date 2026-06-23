---
---

Fix the uPlot reference adapter — the most broken of the example adapters.
Three bugs, one re-pin:

- **Per-series colour (was a BUG).** `buildPaneSeries` hardcoded
  `const stroke = "#3b82f6"`, so every series rendered the same blue and a
  multi-plot script (or the `sma-offset` sample's three SMA copies) collapsed
  to one line. Each `PlotPoint` now carries its per-bar `color`, and the
  stroke is the LAST non-null per-point colour
  (`seriesColor(points, DEFAULT_LINE_COLOR)`, mirroring echarts / konva),
  falling back to `#3b82f6` only for an all-null-colour series.
- **Universal plot `offset` (`PlotEmission.xShift`).** uPlot is the
  aligned-time model, so `applyPlot` now stores each point's `bar` + (non-zero)
  `xShift`, and `buildPaneData` builds the `xs` row EXTENDED with extrapolated
  future columns (`lastTime + k · medianBarSpacing(bars)`) up to
  `maxShiftedTime(...)`, placing each value at the column whose time ===
  `shiftedBarTime({ bars, bar, xShift, spacing })`. A far-past (`−k`) point
  whose shifted time precedes the first bar is clipped (canvas2d parity). All
  shift helpers come from `@invinite-org/chartlang-adapter-kit`. A no-offset
  frame is byte-identical to the pre-offset aligned data.
- **Candle axis overflow.** uPlot auto-ranged x so the last bar sat flush at
  the plot-area right edge, spilling the last candle's half-body into the
  price-axis gutter. The x scale is now pinned to a half-spacing-padded data
  window (`paddedXWindow`, `0.5 × medianBarSpacing` per side), folded into both
  `renderFrame`'s auto-follow branch and `wireUplotInteraction`'s
  `requestRender` (so a held pan/zoom window is padded too). `MockUplot` honours
  `setScale("x")` so the pad is testable headlessly; dblclick → reset →
  padded auto-follow resumes.
- **Draw-pass axis overflow (clip).** The half-spacing x-pad only fixed the
  first/last candle at the DATA boundary; once the user pans/zooms into a
  window with bars to either side, those off-window candles / `bg-color`
  bands / drawings still painted into the price-axis gutter, over the labels
  (uPlot clips its native series, but the `hooks.draw` ctx is the unclipped
  full canvas). `paintPaneOverlay` now brackets the whole hand-rolled pass in
  `save()` → `beginPath()` → `rect(dx, dy, pxWidth, pxHeight)` → `clip()` …
  `restore()`, confining every mark to uPlot's plot bbox on BOTH axes — the
  candle pass now honours the plot edges exactly as the native series do.
  Needs the new `RenderCtx` `rect` + `clip` members (adapter-kit `./canvas`).
- **Built-in legend hidden (`legend: { show: false }`).** uPlot's DOM legend
  labels each series by its chartlang slotId and renders below the chart, so
  in a fixed-height host it overflowed onto the demo's alert feed. Hidden in
  `defaultUplotFactory` (DOM-only); no other example adapter shows a legend.

The integration `PINNED_HASH` was DELIBERATELY re-pinned twice — first for the
x-pad, then for the clip's added `save`/`rect`/`clip`/`restore` ctx calls (the
clipped GEOMETRY is unchanged; the `MockUplot` bbox is the full canvas, so the
clip is a headless no-op on in-bounds marks). The fixture's SMA colour is the
default blue, so the colour fix leaves that hash unchanged on its own. Coverage
stays at 100%; conformance stays green. (Private example package; no published
surface — empty changeset.)
