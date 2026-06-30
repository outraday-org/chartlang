---
"@invinite-org/chartlang-pine-converter": minor
---

Rename a Pine variable whose name collides with a `compute(ctx)` host param
(`bgcolor = …` shadowing the `bgcolor(...)` builtin). The variable's
declaration and every reference take a fresh host-avoiding local (`bgcolor2`)
while the host call site keeps `bgcolor`, fixing the emitted duplicate
identifier. The canonical host-param list is synced with the `compute`
destructure.
