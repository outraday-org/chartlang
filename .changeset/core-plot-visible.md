---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
"@invinite-org/chartlang-pine-converter": minor
---

Add a per-plot authoring `visible` opt — `plot(x, { visible })` (and Pine
`display = display.all | display.none` conversion). Wired into the existing
`PlotEmission.visible` wire field; omitted when visible so existing emissions
stay byte-identical. (adapter-kit needs no change — its `visible` wire field +
validator already exist @since 0.8.)

The compiler also threads a boolean-literal `visible` into a new optional
`manifest.plots[*].defaultVisible` static hint (a host can pre-toggle a legend
entry); an input-driven `{ visible }` is resolved per run and leaves the field
absent, so unused-visibility manifests stay byte-identical.

The conformance suite adds the `PLOT_VISIBLE_SCENARIO` export pinning the wire
contract cross-adapter: `plot(value, { visible: false })` emits `visible: false`
while a no-`visible` plot AND a `visible: true` plot both omit the field
(byte-identical wire), with a control `plot-hash` proving `visible` is never in
the numeric `{ bar, value }` tuple.

The Pine converter (minor — new capability + a new diagnostic code) maps a
`plot(..., display=...)` named arg onto the `{ visible }` opt:
`<cond> ? display.all : display.none` → `{ visible: <cond> }` (the inverted
arm order → `{ visible: !(<cond>) }`), a bare `display.none` → `{ visible:
false }`, and a constant `display.all` (or an omitted `display=`) omits the key
for byte-clean output. Any other `display.*` target (`status_line`/`price_scale`/
`pane`/`data_window`) is left visible with a new `plot-display-approximated`
warning — `display=` is never silently dropped.
