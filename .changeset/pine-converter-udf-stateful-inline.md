---
"@invinite-org/chartlang-pine-converter": patch
---

Inline-expand STATEFUL Pine user-defined functions (`stateful: true`) at every
call site (T1 Task 4), the complement of Task 3's pure-UDF reuse. A stateful
helper cannot be emitted as a shared function — its `ta.*`/`state.*` would share
ONE compiler slot across every caller and cross-contaminate state — so
`udfInline.ts` expands the body at each call site instead: params bind to their
arguments (a non-trivial / call-bearing arg is hoisted to a `const <tmp> =
<arg>;` evaluate-once temp; a bare identifier / literal substitutes inline),
the body is cloned with params + body locals substituted (the new shared
`substituteParams` / `substituteParamsStatement` in `controlFlow.ts`), each
intermediate local lowers to a uniquely-named `let` emitted BEFORE the consuming
statement, and the body's return expression splices into the call's position.
Because each inlined `ta.*`/`state.*` lands at a DISTINCT generated source
position, the compiler's `callsiteIdFor` mints an INDEPENDENT slot per call site
— reproducing Pine's per-call-site state instancing with no compiler change (two
calls to the same helper provably diverge). Nested stateful-UDF-calling-stateful
-UDF composes; a recursive self-call (already `udf-recursive-rejected`) is left
bare via an inline stack guard. New `udf-inlined` + `udf-arg-hoisted` (info)
diagnostics fire. Package-internal; the user-visible converter surface bump is
folded into Task 5's feature changeset.
