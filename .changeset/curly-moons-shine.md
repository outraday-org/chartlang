---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-host-quickjs": patch
"@invinite-org/chartlang-host-worker": patch
---

feat: author-selectable `area` plot style

`{ kind: "area", fillAlpha? }` is now a `PlotOptsStyle` arm — scripts can
select the filled-area render (polyline stroked over a translucent fill down
to the adapter's baseline) directly via `plot(value, { style: { kind:
"area" } })`. The runtime lowers it to the existing `area` wire kind
(`lineWidth` / `lineStyle` from the sibling `PlotOpts` fields, `fillAlpha`
defaulting to `0.2`), the compiler's ambient shim accepts the arm, and the
host dispatcher bundles are rebuilt. The wire `PlotStyle`, validation, and
plot-override semantics are unchanged — adapters that already render the
`area` kind need no changes.
