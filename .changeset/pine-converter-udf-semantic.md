---
"@invinite-org/chartlang-pine-converter": patch
---

Semantic registration + statefulness classification for Pine user-defined
functions (T1 Task 2). `analyze` now hoists every top-level
`FunctionDeclaration` into a `kind: "function"` symbol carrying `params` and a
resolved `stateful` flag, walks each UDF body in a param-seeded child scope
(so call sites stop raising `unknown-identifier` and free body identifiers are
still flagged), and warns `udf-arity-mismatch` on an argument-count mismatch.

Statefulness is computed transitively over the UDF call graph in a pre-pass
(`semantic/statefulness.ts`): a UDF is stateful if its body uses a builtin
stateful primitive (`plot`/`hline`/`alert`/`ta.*`/`draw.*`) or calls another
stateful UDF — the flag Tasks 3/4 read to choose reuse (pure) vs. inline
(stateful). Recursion (direct or mutual) is rejected with
`udf-recursive-rejected` (error), one per cycle on the lexically-first member.
The shared builtin stateful predicate moved from `transform/statefulNames.ts`
into the neutral `semantic/statefulness.ts` (re-exported from the old path) to
avoid a semantic→transform cycle. Package-internal; the user-visible converter
surface bump is folded into Task 5's feature changeset.
