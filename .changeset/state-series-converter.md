---
"@invinite-org/chartlang-pine-converter": minor
---

Lower a history-indexed numeric Pine `var`/`varip` scalar to `state.series`
instead of the non-compiling `state.float`/`int` + `<slot>.value[n]`. Pine's
pervasive `var x := …; x[1]` idiom now converts to working chartlang (`const x =
state.series(<init>); … x.value = …; x[1]`). A numeric `var` never read with
`[n]` keeps its leaner scalar slot. A `bool`/`string` history-indexed `var`
stays out of v1 scope with a clear `series-history-non-numeric` diagnostic, and a
non-literal series offset wires the `dynamic-series-index` error.
