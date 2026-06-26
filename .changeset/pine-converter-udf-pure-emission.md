---
"@invinite-org/chartlang-pine-converter": patch
---

Emit pure (state-free) Pine user-defined functions as reusable chartlang
arrow-function `const`s (T1 Task 3). `transformOther` now hoists every
`stateful: false` UDF to the FRONT of the compute body — after the state-slot
allocations, before any non-UDF statement — ordered callee-before-caller by a
topological sort over the call graph, so every helper precedes its first call
site and a single shared function replaces Pine's per-call evaluation (a pure
helper is referentially transparent). Params are emitted verbatim (registered
as shadowing locals so a param/local never picks up an `inputs.*` / state-slot
rewrite, while a free input/`var` reference in the body still rewrites);
intermediate body locals lower to `let`s and the body's implicit-return last
statement yields the `return`. A new `udf-emitted-function` (info) is raised
per emitted UDF. Stateful UDFs are excluded (Task 4 inlines them at each call
site); the statement walk's `function-declaration` arm stays a no-op shared by
both paths. Package-internal; the user-visible converter surface bump is folded
into Task 5's feature changeset.
