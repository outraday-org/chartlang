---
"@invinite-org/chartlang-conformance": minor
---

Pin the plot-override channel end to end and document it. The
`PLOT_STYLE_OVERRIDES_SCENARIO` conformance scenario exercises mount-time
`visible` / `color` / `lineWidth` overrides (keyed by `manifest.plots`
ordinal, not a hardcoded `slotId`), a live `setPlotOverrides` flip that
clears a hide mid-stream, and empty-override numeric-series parity against
the no-override baseline. A new opt-in `plot-field` `ScenarioAssertion`
inspects override-baked presentation fields, and `Scenario` gains optional
`plotOverrides` + `overrideEvents`. The canvas2d reference adapter now
honors `PlotEmission.visible === false` (skips render + viewport) and the
override-baked color; cross-host byte-identical parity for the override set
is pinned in `host-quickjs`'s integration parity test. Docs cover the
`visible?` emission field, the `plots?` manifest slot list,
`Adapter.resolvePlotOverrides`, the host `plotOverrides` load field +
`setPlotOverrides` frame, and a new plot-overrides walkthrough.
