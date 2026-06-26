---
"@invinite-org/chartlang-pine-converter": patch
---

Parser + AST for Pine user-defined function declarations (T1 Task 1). Add a
`FunctionDeclaration` statement node (`name`, `FunctionParam[]`, `body:
BlockStatement`) and teach `parseStatement` to recognize the `name(params) =>`
head in both the single-line (`f(a, b) => expr`) and multi-line (indented body
with an implicit last-expression return) forms. Two append-only parse
diagnostics ride this: `udf-typed-param-unsupported` (warning — a typed param
is treated as its bare name) and `udf-param-default-unsupported` (error — a
defaulted param rejects the whole declaration). Parse-only; semantic
registration and emission land in T1 Tasks 2–4 (the public converter surface is
unchanged here, so the user-visible bump is folded into Task 5's feature
changeset).
