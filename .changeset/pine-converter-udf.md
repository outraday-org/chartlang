---
"@invinite-org/chartlang-pine-converter": minor
---

Pine **user-defined function declarations** now convert (T1). A helper written
`f(a, b) => expr` (single-line) or with a multi-line indented body (whose last
statement is the implicit return) lowers two ways depending on whether its body
is stateful: a **pure** (state-free) helper hoists to a reusable chartlang
arrow-function `const` at the top of `compute` that every call site reuses,
while a **stateful** helper (one that transitively calls `ta.*` / `state.*` /
`plot` / `hline` / `alert` / `draw.*`) is **inline-expanded at each call site**.
Inlining is a correctness requirement, not an optimisation: chartlang keys every
`ta.*` / `state` slot by lexical source position, so a shared function would make
all callers collide on one slot and cross-contaminate state — inlining gives each
call site its own slot, reproducing Pine's per-call-site state instancing (two
calls to the same helper provably diverge).

A pure helper's params are emitted with a `: number` type annotation so the
hoisted arrow type-checks (an untyped param trips the compiler's `noImplicitAny`),
and a nested `math.*` call in any body now lowers its callee to the bare-native
`Math.*` passthrough (`math.max(math.min(a, b), c)` → `Math.max(Math.min(a, b),
c)`) — the `math` sibling of the existing nested-`ta.*` lowering — so a pure
helper like `cf_limit` round-trips cleanly through the compiler.

New diagnostics ride this: `udf-emitted-function`, `udf-inlined`,
`udf-arg-hoisted` (info), `udf-typed-param-unsupported`, `udf-arity-mismatch`
(warning), and the `udf-param-default-unsupported` / `udf-recursive-rejected`
rejects (error). Fixtures `42`–`46` exercise the surface — the pure-helper
round-trip (`42`), the divergence witness (`43`), the faithful Trend Wizard
helper cluster (`45`), and the recursion reject (`44`) convert cleanly; one v1
limitation is documented and tracked: a stateful helper that indexes a param's
history only inlines cleanly when applied to an OHLCV argument (a derived-series
argument needs a `state.series` promotion, a planned follow-up).
