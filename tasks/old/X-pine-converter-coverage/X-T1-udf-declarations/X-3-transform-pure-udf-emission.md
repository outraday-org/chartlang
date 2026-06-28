# Task 3 — Transform: pure-UDF emission as reusable chartlang functions

> **Status: TODO**

## Goal

Lower **pure** UDFs (Task 2 `stateful: false`) to real, reusable chartlang
functions emitted at the top of `compute`, before their first use. Rewrite
every call site to the chartlang function name. This is the easy, correct half
of UDF support: a pure helper is referentially transparent, so a single shared
function is semantically identical to Pine's per-call instancing — no inlining
needed.

## Prerequisites

Tasks 1–2 (`FunctionDeclaration` AST + UDF symbols with `stateful` flag +
body scope).

## Current Behavior

- `transformOther` (`packages/pine-converter/src/transform/other.ts`)
  populates `computeBody` for every non-drawing top-level statement and runs
  FIRST in the pipeline so scalar `let`s precede the drawing pushes that read
  them (`packages/pine-converter/CLAUDE.md` §Transform: control flow). It has
  no arm for `function-declaration` (skips / mis-handles it today).
- Compute-body statements are **verbatim chartlang source strings** appended
  via `appendComputeStatement` (the established IR; codegen is pure
  templating).
- Identifier rewriting (input refs → `inputs.<name>`, scalar `var` →
  `<slot>.value`) happens in `emitWithContext` (`src/transform/emitContext.ts`)
  wrapping `emitExpr` (`src/transform/exprEmit.ts`).
- Synthesized names route through the `NameAllocator`
  (`src/transform/nameAllocator.ts`) — no `__` prefixes (repo invariant).

## Desired Behavior

```pine
cf_limit(input_val, upper_limit, lower_limit) =>
    math.max(math.min(input_val, upper_limit), lower_limit)
x = cf_limit(v, 1, -1)
```
→

```ts
compute({ bar }) {
    const cf_limit = (input_val, upper_limit, lower_limit) =>
        Math.max(Math.min(input_val, upper_limit), lower_limit);
    let x = cf_limit(v, 1, -1);
}
```

- Single-line body → an arrow with an expression body.
- Multi-line body → an arrow with a block body whose **last** statement becomes
  `return <expr>;` and intermediate `x = …` lines become local `const`/`let`.
- Emitted **before** the first call site (function hoist to the top of the
  compute body, after slot allocations).

## Requirements

### 1. Emit pure UDFs first (`src/transform/other.ts`)

- Add a `function-declaration` handling path in `transformOther`. For a
  `stateful: false` symbol, render the body with `emitWithContext` (so any
  `math.*`, `input`, nested-`ta` — see note — and param refs lower correctly),
  producing a chartlang arrow-function source string, and `appendComputeStatement`
  it **ahead of** the non-UDF statements.
- Ordering: **topo-sort** the pure UDFs by the call graph (built in Task 2) so
  a callee is emitted **before** its caller, then emit that sorted list at the
  **top of the compute body** — after the state-slot allocations, before any
  non-UDF statement. (So `cf_a` that calls pure `cf_b` is emitted after `cf_b`;
  both precede the first call site.)

### 2. Body lowering (params, locals, implicit return)

- **Params**: emit verbatim as the arrow parameter list. Inside the body,
  construct a **fresh `EmitContext` per UDF** whose `localNames` is seeded from
  the param names (plus any body locals from §Locals). Because the
  shadowing-local check runs FIRST in `emitContext.ts` (the same rule applied to
  loop iterators / `let`-declared names), a param reference stays verbatim
  (`input_val`, not `inputs.input_val`) — the input/slot/tuple rewrites are
  bypassed for those names.
- **Locals**: each intermediate `x = expr` body statement → `const x = <expr>;`
  (or `let` if reassigned in the body). Reuse the existing assignment lowering;
  register these as shadowing locals too.
- **Implicit return**: the body block's last statement's expression becomes
  `return <expr>;`.

### 3. `math.*` / nested-`ta` inside the body

- `math.max/min/abs/round/...` lower exactly as in top-level code (native
  `Math.*` — already handled by the existing `math` passthrough / `emitExpr`).
- A pure UDF by definition contains **no** `ta.*`/`state` (Task 2), so the
  nested-`ta` `.current` concern (T2) does not apply here — that is only the
  stateful-inline path (Task 4). Keep this task strictly pure.

### 4. Call-site rewrite

- A call `cf_limit(v, 1, -1)` already emits as `cf_limit(<args>)` through
  `emitExpr` by identity; ensure the callee name is NOT rewritten (it is a
  local function name, not an input/slot — register UDF names as known locals
  in `EmitContext` so the input/slot rewrite skips them).
- Args lower through `emitWithContext` (so an arg that is an input/slot/`ta.*`
  lowers normally in the **caller's** context).

### 5. Diagnostics (`src/diagnostics/codes.ts`, append-only)

- `udf-emitted-function` (info) — a pure UDF was emitted as a reusable
  function (the converse of Task 4's `udf-inlined`). Optional but symmetrical;
  helps the docs/diagnostics page explain the inline-vs-reuse split.

### 6. Tests (`src/transform/other.*.test.ts`)

- A pure single-line UDF emits an arrow with an expression body; a multi-line
  pure UDF emits a block body with `return` + locals.
- Param refs are not rewritten to `inputs.*`; an input passed as an arg IS
  rewritten in the caller.
- A pure UDF calling another pure UDF emits in dependency order.
- The emission precedes the first call site.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/other.ts` | Modify | `function-declaration` path for pure UDFs; topo-ordered prepend; body lowering. |
| `packages/pine-converter/src/transform/emitContext.ts` | Modify | Register UDF names + param/local names as shadowing locals (skip input/slot rewrite). |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Append `udf-emitted-function` (info). |
| `packages/pine-converter/src/transform/other.test.ts` | Modify | Pure-UDF emission coverage. |
| `packages/pine-converter/CLAUDE.md` | Modify | Document pure-UDF emission + ordering + param-as-shadowing-local. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (coverage **100%**)

## Changeset

Covered by Task 5's feature changeset.

## Acceptance Criteria

- Trend Wizard's `cf_limit`, `format_trend_text`, and `get_dynamic_color`
  (pure) convert to reusable chartlang functions emitted before first use,
  with params left verbatim and locals/implicit-return correct.
- Pure-UDF call sites compile and reuse the single function (no inlining).
- Converter transform coverage stays 100%.
