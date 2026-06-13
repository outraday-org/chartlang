---
"chartlang-example-canvas2d-adapter": patch
---

Canvas2d subpane polish: a per-pane price y-axis (faint gridlines + right-gutter
tick labels) so plotted values are readable, an 80/20 price/subpane split (was
70/30) to give the price pane more room, a visible `paneBorder` divider between
panes (new palette slot), and a differentiated `explicit-pane-routing` demo that
routes 70/30 RSI overbought/oversold bands into the subpane via
`hline(..., { pane })`.
