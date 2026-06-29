---
"@invinite-org/chartlang-pine-converter": patch
---

Consolidate `input-arg-not-mapped` and `table-formatting-not-mapped` to one
diagnostic per distinct unmapped argument name across the whole script (the
representative span is the first occurrence), instead of one per call site.
A script with ~150 grouped inputs now reports ~4 input-arg warnings, not 228,
and a styled on-chart table ~3 cell-formatting warnings, not 6. The
`request.security` `gaps=` info is likewise consolidated to once per script.
Mapped-argument behavior (including the dynamic `bgcolor`/`text_color` table
path) is unchanged.
