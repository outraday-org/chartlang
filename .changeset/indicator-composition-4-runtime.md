---
"@invinite-org/chartlang-runtime": minor
---

`createScriptRunner` accepts `CompiledScriptBundle`, mounting a
`DepRunner` per private dep + `SiblingRunner` per drawn export.
Executes deps + siblings before the primary each bar; filters
emissions per export-status; surfaces `dep-error` with parent-bar
halt semantics. `__chartlang_depOutput` is exposed via the new
`@invinite-org/chartlang-runtime/internal` subpath for compiler-
emitted bundles. Single-`CompiledScriptObject` callers byte-identical.
