---
"@invinite-org/chartlang-pine-converter": patch
---

Fix both `switch` parsers to tolerate a blank or comment-only line between or
after the arms. A trailing blank/comment line (the common Pine idiom of a
`switch` block followed by a section comment) previously left a stray `newline`
between the last arm and the block `dedent`: the statement form cascaded an
`unexpected-token` into every following statement, and the value form misfired
`switch-expression-unsupported` on the empty "arm" and degraded the whole
`switch` to a placeholder. Both arm loops now `skipNewlines()` before each arm,
so a value-form `switch` whose single-expression arms are followed by a blank
line (e.g. the `cf_ma` MA-selector helper) converts cleanly.
