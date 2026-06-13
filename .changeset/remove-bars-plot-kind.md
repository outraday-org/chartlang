---
"@invinite-org/chartlang-core": patch
"@invinite-org/chartlang-adapter-kit": patch
"@invinite-org/chartlang-compiler": patch
---

Remove the redundant `bars` plot kind. It was never reachable from the script-author API (`PlotOptsStyle` had no `bars` arm and the runtime `buildStyle` had no `case`), no `ta.*` primitive or example emitted it, and the canvas2d reference adapter declared it as a capability but never rendered it. It carried the same `{ baseline: number }` shape as `histogram`, so it was a dead arm of the `PlotKind` / wire-level `PlotStyle` unions.

`PlotKind`, the adapter-kit `PlotStyle` union, `validateEmission`, the `capabilities.bars()` / `PHASE_5_PLOT_KINDS` surfaces, and the canvas2d adapter's dead `bars.ts` renderer are all dropped. chartlang has no users yet, so this is a hard reset with no deprecation path. Authors who want columns use `histogram`.
