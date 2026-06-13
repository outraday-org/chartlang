---
"chartlang-example-canvas2d-adapter": patch
---

Wire the pure pane-layout helpers into `createCanvas2dAdapter`. The
adapter state is now pane-aware: `plotSeries` / `plotSeriesStyle` are
keyed by `${paneKey}|${slotId}`, `hlines` carry their pane key, and a
mutable `paneOrder` (`["overlay", ...subpaneKeys]`) grows on first-seen
non-overlay pane and resets on `dispose`. `renderFrame` walks
`computePaneLayout` and draws each pane inside its rect via
`save / translate(0, rect.y) / restore`, with an independent y-scale per
pane (a 0-100 oscillator subpane no longer stretches the price scale),
bars in the overlay pane only, and a separator between panes. Adds
`translate` to the `RenderCtx` type and `MockCanvas2DContext`. The
per-frame whole-canvas `clear` is replaced by per-pane `clearPaneRect`,
which re-shapes the integration call log (the pinned hash is re-pinned;
behaviour is unchanged for overlay-only scripts).
