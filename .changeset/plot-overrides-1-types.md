---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-adapter-kit": minor
---

Add the additive plot-override contract: `PlotSlotDescriptor`,
`PlotOverride`, `ScriptManifest.plots?`, `PlotEmission.visible?`, and
`Adapter.resolvePlotOverrides?`. `validateEmission` now accepts an
optional `visible: boolean` arm on plot emissions and rejects any
other type via the existing `malformed-emission` path.

No behavior changes ship in this contract step — every new field is
optional and absence keeps emissions byte-identical to today. The
compiler's ambient core shim gains `PlotSlotDescriptor` and the
`ScriptManifest.plots?` field so script-side `__manifest` consumers
stay in lockstep; `PlotOverride` is intentionally not shimmed (it is
runtime-/host-side only).
