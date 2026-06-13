---
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-host-worker": minor
"@invinite-org/chartlang-host-quickjs": minor
---

Apply host-supplied plot overrides at emit time and add a live `setPlotOverrides` channel. The runtime resolves an initial `plotOverrides` map at mount (`args.plotOverrides ?? args.resolvePlotOverrides?.(...)`), applies the matching `PlotOverride` to every `PlotEmission` by `slotId` via the new pure `applyPlotOverride` helper (visibility / color / line width / line style for line-family kinds; silent no-op otherwise), and exposes `ScriptRunner.setPlotOverrides(next)` for a recompute-free live swap. Both `host-worker` and `host-quickjs` forward an initial `plotOverrides` on the `load` frame (mirroring `inputOverrides`) and relay a new `setPlotOverrides` host→guest frame; `ScriptHost.setPlotOverrides(...)` is added for cross-host parity. Fully additive: with no overrides supplied, every emission is byte-identical to before (the `visible` field is omitted unless a slot is explicitly hidden).
