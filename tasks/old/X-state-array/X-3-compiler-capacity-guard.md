# Task 3 — Compiler: capacity-literal guard for `state.array` (optional)

> **Status: TODO**

## Goal

Add a compile-time analysis that requires `state.array<T>(capacity)`'s
`capacity` argument to be a numeric literal (optionally ≤ a configured
maximum), emitting a diagnostic otherwise. This pins the bounded-execution +
bounded-snapshot invariant at the compiler boundary, mirroring how series
index bounds are validated. **This task is OPTIONAL** — the runtime ring
self-bounds at the given capacity regardless, so a non-literal capacity is
already safe at runtime; this guard turns a latent footgun (an unbounded /
non-deterministic snapshot size) into a clear compile error.

## Prerequisites

Task 1 (`state.array` registered as `{ slot: true }`, so the slot id is
injected and the callsite is recognised by name).

## Current Behavior

- The compiler injects a leading `slotId` literal at every `{ slot: true }`
  callsite (`packages/compiler/src/transformers/callsiteIdInjection.ts:121-172`),
  resolving the callee by name (`resolveCalleeName`). For
  `state.array(cap)` it emits `state.array("<id>", cap)` — `cap` is passed
  through untouched.
- The in-loop ban (`packages/compiler/src/analysis/statefulCallInLoop.ts:40-55`)
  errors `stateful-call-inside-loop` for any registry callsite — so the
  **allocation** `state.array(...)` cannot sit in a loop. `.push`/`.get` are
  method calls, not registry callsites, so they are unaffected (verified in
  Task 1's compile test).
- `extractMaxLookback` / `resolveIndexUpperBound`
  (`packages/compiler/src/analysis/`) resolve a numeric **literal** /
  bounded-loop induction var / `const` numeric binding for **series index
  bounds** (`s[N]`). There is no analogue checking a primitive's **argument**
  is a literal.
- No pass currently inspects `state.array`'s capacity argument.

## Desired Behavior

- `const a = state.array<number>(20);` — capacity is a numeric literal →
  **no** diagnostic.
- `const a = state.array<number>(len);` where `len` is not a numeric literal
  (a `let`, an input, a runtime expression) → an **error** diagnostic
  `state-array-capacity-not-literal` at the argument span, with a message
  pointing the author to use a literal.
- (Optional sub-feature) `const a = state.array<number>(1_000_000);` exceeding
  a configured cap (e.g. `MAX_STATE_ARRAY_CAPACITY`) → an **error**
  `state-array-capacity-exceeds-max`. Pick a generous default (e.g. the same
  `5000` `dynamicFallback` ceiling series indices use, or higher) and document
  it. This sub-feature is itself optional within the optional task — ship it
  only if there is a clear ceiling to enforce.
- A `const`-numeric-literal binding used as capacity (`const K = 20; …
  state.array(K)`) is **accepted** as a literal IF you reuse the existing
  `const`-numeric resolution (`collectConstNumberEnv` /
  `resolveIndexUpperBound`'s const path); if reusing that is heavy, accepting
  only a bare numeric literal in v1 is fine — document the limitation.

## Requirements

### 1. New analysis (`packages/compiler/src/analysis/stateArrayCapacity.ts`, new)

Walk the **original** AST (per the "static-analysis runs on the original AST"
invariant in `compiler/CLAUDE.md`). For each `CallExpression` whose
`resolveCalleeName(node, checker) === "state.array"`:

- Read the **capacity argument** — the FIRST positional argument **in the
  source** (the analysis runs pre-injection, so there is no injected slotId
  yet; the capacity is `node.arguments[0]`).
- Resolve it: a `NumericLiteral` (or a parenthesised / unary-plus numeric
  literal) is OK. Reuse `unwrapParens` from `analysis/loopBounds.ts` (the
  shared leaf module) and, if accepting `const` bindings, the existing
  numeric-`const` resolver path — do **not** re-implement number parsing.
- If unresolvable → push `state-array-capacity-not-literal` (error).
- (Optional) If resolved but `> MAX_STATE_ARRAY_CAPACITY` (or `<= 0`,
  non-integer, non-finite) → push `state-array-capacity-exceeds-max` (error)
  or a more specific message; reuse the diagnostic-construction helper
  (`createDiagnostic`).

Register the new code(s) wherever the compiler's diagnostic codes are
enumerated (follow the registration the existing `dynamic-series-index` /
`stateful-call-inside-loop` codes use). Wire the new pass into the analysis
pipeline next to `statefulCallInLoop` / `structuralChecks` (find where those
are invoked in `transformAndAnalyse`).

### 2. Element-access / dynamic-callee robustness

`state["array"](cap)` is already rejected upstream as
`stateful-call-element-access` (`callsiteIdInjection.ts:103-117`) — confirm
the new pass does not double-report (it resolves the callee the same way;
element-access forms won't match `"state.array"` via `resolveCalleeName`).

### 3. Tests (`stateArrayCapacity.test.ts` + `compile.test.ts`)

- `state.array<number>(20)` → no diagnostic.
- `state.array<number>(len)` (a `let len = …`) → one
  `state-array-capacity-not-literal` error at the arg span.
- (If the const path is reused) `const K = 20; state.array<number>(K)` → no
  diagnostic; `let K = 20; state.array<number>(K)` → error.
- (If the max sub-feature ships) over-cap / zero / negative / non-integer
  literal → the appropriate error.
- 100% coverage on the new analysis file (cover every diagnostic arm + the
  accept arm).
- `compile.test.ts`: a negative `compile()` case asserting the non-literal
  capacity produces the diagnostic (end-to-end through the pipeline), and the
  Task 1 positive case still compiles clean.

## Edge cases

- The capacity is `node.arguments[0]` at analysis time (pre-injection). Do NOT
  read `arguments[1]` (that is the runtime-injected slotId position, which does
  not exist yet on the original AST).
- A `state.array` allocation inside a loop is already an error
  (`stateful-call-inside-loop`); the capacity pass may also fire — that is two
  diagnostics for one obviously-wrong callsite, acceptable (mirror how an
  element-access stateful call can collect multiple codes). Or short-circuit if
  the codebase prefers one diagnostic per node — match precedent.
- Diagnostic severity: **error** (a non-literal capacity breaks the
  bounded-snapshot guarantee; it is not a warning). Confirm against how the
  team treats analogous safety violations.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/compiler/src/analysis/stateArrayCapacity.ts` | Create | Capacity-literal (+ optional max) guard. |
| `packages/compiler/src/analysis/stateArrayCapacity.test.ts` | Create | Accept/reject + bounds coverage. |
| `packages/compiler/src/analysis/index.ts` (or the pipeline site) | Modify | Wire the pass in next to `statefulCallInLoop`. |
| `packages/compiler/src/diagnostics.ts` (or the code registry) | Modify | Register `state-array-capacity-not-literal` (+ optional `-exceeds-max`). |
| `packages/compiler/src/compile.test.ts` | Modify | End-to-end negative + positive cases. |

## Gates

- `pnpm -F @invinite-org/chartlang-compiler test` (coverage **100%** on the new
  file)
- `pnpm typecheck`, `pnpm lint`

## Changeset

Covered by Task 1's feature changeset (compiler is included as minor).

## Acceptance Criteria

- A numeric-literal capacity compiles clean; a non-literal capacity errors
  `state-array-capacity-not-literal` at the argument span.
- (If shipped) an over-cap / non-positive / non-integer literal errors.
- `.push`/`.get` method calls and the Task 1 positive case are unaffected.
- New analysis at 100% coverage; typecheck/lint green.

> **If this task is skipped:** the runtime still bounds the ring at the given
> capacity, so a non-literal capacity is memory-safe; the only loss is a
> non-deterministic snapshot size and a missed early error. Note in Task 6's
> docs that capacity "should be a literal" rather than "must be" if the guard
> is not shipped.
