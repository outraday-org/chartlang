# Task 4 — Transform: stateful-UDF inline expansion + per-call-site slot isolation

> **Status: TODO**

## Goal

Lower **stateful** UDFs (Task 2 `stateful: true`) by **inline-expanding** the
body at every call site, substituting argument expressions for parameters, so
each emitted `ta.*`/`state.*` becomes a **distinct lexical call site** and
therefore an independent slot. This reproduces Pine's per-call-site instancing
— the reason a shared function would be wrong. This is the hard half of UDF
support and the crux of T1.

## Prerequisites

Tasks 1–2 (AST + `stateful` classification). **T2** (nested-`ta` `.current`
lowering) — the inlined body is full of nested `ta.*`; land T2 first or
together so the expanded body compiles.

## Current Behavior

- chartlang keys every `ta.*`/`state` slot by **lexical source position**:
  `<sourcePath>:<line>:<col>#<callIndex>`, minted by `callsiteIdFor`
  (`packages/compiler/src/callsiteIdInjection.ts`); the runtime keys per-script
  state on that exact string (`packages/compiler/CLAUDE.md` §Callsite-id
  format). So one textual `ta.ema(...)` inside a shared helper = ONE slot,
  shared across every caller → cross-contaminated state. **This is why a
  stateful UDF cannot be emitted as a reusable function.**
- The converter already has the substitution machinery:
  `substituteIterator` (`src/transform/statefulNames.ts:115`, re-exported from
  `src/transform/index.ts`) rewrites an iterator variable to a concrete value
  across an expression/statement tree — the same shape needed for param→arg
  substitution. `tables.ts` and `polylineLinefill.ts` already reuse it for loop
  unrolling.
- Loop unrolling is the existing precedent for "emit N distinct copies so each
  stateful call gets its own slot" (`emitFor` in `controlFlow.ts`): a stateful
  loop body is unrolled rather than emitted as a runtime `for` precisely
  because the compiler rejects a stateful call in a loop and each iteration
  needs its own slot.

## Desired Behavior

```pine
cf_slope(ma, n) => ta.ema(((ma - ma[1]) / ma[1] * 100), n)
ma_1_slope = cf_slope(ma_1, 2)
ma_2_slope = cf_slope(ma_2, 1)
```
→ each call inlines, so the two `ta.ema`s sit at different source positions and
get **independent** state:

```ts
let ma_1_slope = ta.ema((((ma_1) - (ma_1)[1]) / (ma_1)[1] * 100), 2).current;
let ma_2_slope = ta.ema((((ma_2) - (ma_2)[1]) / (ma_2)[1] * 100), 1).current;
```

Multi-line bodies inline as a block: intermediate locals become uniquely-named
synthesized `const`s (via the `NameAllocator`), and the body's last expression
substitutes into the call site's consuming context.

## Requirements

### 1. Inline expansion at the call site (`src/transform/other.ts` + a new `udfInline.ts`)

- The inliner dispatches from the **`transformOther` statement walk** (or a
  dedicated `udfInline.ts` transform it calls), NOT from `emitWithContext`:
  `emitWithContext`/`emitExpr` are pure identifier-rewrite functions and do not
  dispatch on call structure or splice statements. When the statement walk
  encounters a call whose callee resolves to a **stateful** UDF symbol, expand
  it (it can then USE `emitWithContext` to lower the substituted sub-expressions
  in the caller's context):
  1. bind each param to its corresponding **arg expression** (Task 2 arity is
     validated; extra/missing args already warned),
  2. substitute params → arg ASTs throughout a **clone** of the body (reuse /
     generalize `substituteIterator` to accept a `Map<paramName, ExpressionNode>`;
     factor a `substituteParams(node, bindings)` helper next to it),
  3. apply the T2 nested-`ta` `.current` lowering to the substituted body,
  4. for a **single-line** body, the result is the substituted expression
     spliced into the caller's position;
  5. for a **multi-line** body, emit the intermediate locals as synthesized
     `const`s (unique names via `NameAllocator.allocate`) **before** the
     consuming statement, then splice the last expression.

### 2. Argument capture (evaluate-once)

- Pine evaluates each argument **once**. Naive textual substitution duplicates
  an arg every time the param appears (e.g. `ma` appears 3× in `cf_slope`),
  which re-emits the arg's own `ta.*` at multiple positions → multiple slots →
  wrong. **Hoist non-trivial args to a temp** before inlining:
  - an arg that is a bare identifier / literal / simple member access is
    safe to substitute inline (no hoist);
  - an arg containing a call (esp. `ta.*`/a stateful UDF) or used by a param
    referenced **more than once** in the body → hoist to a synthesized
    `const <tmp> = <arg>;` and substitute the param with `<tmp>`.
  - Decide the threshold (ref-count > 1 OR arg-not-simple) and document it.

### 3. Slot isolation correctness

- After inlining, each `ta.*`/`state.*` in the expanded body occupies a unique
  source line:col, so `callsiteIdFor` mints distinct slot ids automatically —
  **no compiler change required**. Add a golden/test proving two calls diverge
  (different seeds/inputs → different outputs), which would be impossible under
  a shared slot. This is the key correctness witness.

### 4. Name hygiene

- Every synthesized local (hoisted arg temp, inlined body local) is allocated
  via `scaffold.names.allocate(...)` so it cannot collide with a Pine
  identifier or another inline expansion — no `__` prefixes (the
  `nameAllocator.ts` invariant). Two expansions of the same UDF get fresh names
  each time (each call site is independent).

### 5. Diagnostics (`src/diagnostics/codes.ts`, append-only)

- `udf-inlined` (info) — a stateful UDF call was inline-expanded (names the UDF
  + call span). Pairs with Task 3's `udf-emitted-function`.
- `udf-arg-hoisted` (info, optional) — an arg was hoisted to a temp for
  evaluate-once correctness.

### 6. Interaction with existing passes

- The inline expansion must run where the call is emitted (caller context), so
  the substituted body inherits the **caller's** input/slot rewrites for the
  arg expressions while keeping the UDF param names shadowed. Confirm ordering
  vs. `transformOther`-runs-first (the inlined locals must precede the
  consuming statement, like scalar `let`s precede drawing pushes).
- A stateful UDF used inside a **loop** body compounds with loop unrolling.
  **v1 decision: compose the two layers** — the loop unrolls first (it already
  must, since a stateful body forces unroll), and each unrolled iteration then
  inlines the UDF independently, so every iteration's `ta.*`/`state.*` lands at a
  distinct source position and gets its own slot. This works whenever the loop
  bound is unroll-resolvable; a non-resolvable bound already rejects via
  `loop-bounds-not-literal-for-stateful-body` (no new code). Only if the two
  layers genuinely cannot compose (e.g. a binding that survives substitution
  unresolved) does the inliner reject with a new `udf-inline-in-loop-unsupported`
  (error) — append it if and only if a real case requires it. Add a test for the
  composing case.

### 7. Tests (`src/transform/udfInline.test.ts` + `other.*.test.ts`)

- A stateful UDF called twice inlines to two independent `ta.*` sites
  (distinct emitted positions); a golden proves divergent state.
- Param referenced multiple times with a `ta.*` arg → arg hoisted once.
- Multi-line stateful body inlines with uniquely-named locals + spliced return.
- Synthetic-AST coverage for defensive arms (non-stateful call reaching the
  inline path, missing binding) per the established precedent.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/udfInline.ts` | Create | Param→arg substitution, arg hoisting, body splice. |
| `packages/pine-converter/src/transform/statefulNames.ts` | Modify | Generalize `substituteIterator` → shared `substituteParams(node, bindings)`. |
| `packages/pine-converter/src/transform/other.ts` | Modify | Dispatch stateful-UDF calls to the inliner; order locals before consumers. |
| `packages/pine-converter/src/transform/emitContext.ts` | Modify | Caller-context arg lowering + param shadowing during inline. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Append `udf-inlined`, `udf-arg-hoisted`. |
| `packages/pine-converter/src/transform/udfInline.test.ts` | Create | Inline + hoist + slot-isolation coverage. |
| `packages/pine-converter/CLAUDE.md` | Modify | Document the inline-vs-reuse rule, evaluate-once hoisting, and the slot-isolation rationale. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (coverage **100%**)

## Changeset

Covered by Task 5's feature changeset.

## Acceptance Criteria

- A stateful UDF (e.g. `cf_slope`) called with different MAs inlines to
  independent `ta.*` slots; a golden witnesses divergent state (impossible
  under a shared function).
- Args with side effects / multi-referenced params are hoisted evaluate-once.
- All synthesized names are collision-safe (no `__`).
- `udf-inlined` info fires; converter coverage stays 100%.
