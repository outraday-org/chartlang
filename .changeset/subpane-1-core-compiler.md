---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
---

Persist `defineIndicator({ overlay })` onto `ScriptManifest.overlay?:
boolean` so the runtime has a script-level default-pane signal. Add
`HLineOpts.pane?: "overlay" | "new" | string` mirroring `PlotOpts.pane`
so hlines opt into the same pane router. The compiler's `buildManifest`
extracts the literal-boolean `overlay` from the `defineIndicator`
object literal via `extractOverrides` and emits it on the bundled
`__manifest`; the ambient core shim now carries `ScriptManifest.overlay?`
and `HLineOpts.pane?` to keep downstream packages type-aligned.

Step 1 of the `subpane-rendering` feature. Pure additive contract
change — every new field is optional and absence keeps existing
manifests / emissions byte-identical. The runtime, adapter, and demos
land in tasks 2-5.
