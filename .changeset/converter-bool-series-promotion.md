---
"@invinite-org/chartlang-pine-converter": minor
---

Back a history-indexed boolean local with `state.boolSeries` instead of the
numeric `state.series`. A promoted `=`-decl / direct-`ta.cross*` series whose
value is boolean (a comparison, `and`/`or`/`not`, or a boolean ternary) now
chooses its slot element type, so the per-bar `<slot>.value = <boolean>` write
and `<slot>[n]` reads type-check.
