---
"@invinite-org/chartlang-pine-converter": patch
---

Add the control-flow + passthrough transform (`transformOther`), the last
stage that populates the converted `compute` body for every non-drawing Pine
statement: `if`/`else if`/`else`, literal- and `input.int`-bounded `for`
(unrolled when the body calls a stateful primitive), `switch`/`case`,
ternaries, scalar `var`/`varip`/`:=` lowered to `state.*` slots, `ta.*` /
`math.*` / `str.*` passthrough, the `plot`/`plotshape`/`hline`/`bgcolor`
family, `request.security` single-symbol MTF reads, and strategy-as-indicator
signal alerts. Drawing statements already owned by the Camp A/B/C, table, and
polyline/linefill transforms are skipped so the body never double-emits a
drawing or lands a `draw.*` inside a loop.
