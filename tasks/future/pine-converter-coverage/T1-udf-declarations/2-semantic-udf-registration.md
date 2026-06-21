# Task 2 — Semantic: UDF symbol registration + statefulness classification

> **Status: TODO**

## Goal

Make the semantic pass aware of the `FunctionDeclaration` node from Task 1:
register each UDF as a callable symbol with its parameter list, build a
per-UDF **scope** so param references resolve inside the body, and classify
each UDF as **pure** or **stateful** — transitively (a UDF is stateful if its
body contains a stateful primitive `ta.*`/`state.*`/`plot`/`hline`/`alert`/
`draw.*` **or** calls another stateful UDF). This classification is the
load-bearing input that Tasks 3–4 read to choose *reuse* (pure → emit a real
function) vs. *inline* (stateful → expand per call site).

## Prerequisites

Task 1 (`FunctionDeclaration` AST node + parser).

## Current Behavior

- `analyze(script)` (`packages/pine-converter/src/semantic/analyze.ts`) walks
  the script building `scopes`, `symbols`, `lifetimes`, and the drawing-camp
  views. It has a `walkExpression`/statement walk with arms per statement kind;
  there is **no** arm for `function-declaration` (it did not exist).
- Today a `cf_slope(e, 2)` call resolves `cf_slope` against the symbol table;
  with no UDF symbol registered it emits `semantic/unknown-identifier` (the 8
  errors seen in the T1 README evidence).
- The stateful-primitive detector already exists for the loop-unroll decision:
  `callIsStatefulPrimitive` + `expressionHasStatefulPrimitive`
  (`src/transform/statefulNames.ts:50,83`) and `bodyHasStatefulPrimitive`
  (`src/transform/controlFlow.ts:259`). These currently only know about
  builtin stateful primitives, **not** UDF→UDF calls.

## Desired Behavior

- Each `FunctionDeclaration` registers a `SymbolInfo` of a new
  `kind: "function"` carrying `params: readonly string[]` and a resolved
  `stateful: boolean`.
- A call `cf_slope(e, 2)` resolves to that symbol (no more
  `unknown-identifier`); arity mismatch → a new
  `udf-arity-mismatch` warning.
- Inside the body, param names resolve to the param symbols (a child scope);
  free identifiers resolve to outer (module) symbols as usual.
- `stateful` is computed transitively over the UDF call graph (topological /
  fixpoint), so `cf_a` that calls stateful `cf_b` is itself stateful.

## Requirements

### 1. Function symbol + body scope (`src/semantic/analyze.ts`)

- Add a `walkFunctionDeclaration` arm: `defineSymbol(name, { kind: "function",
  params, declSpan, stateful: <computed in §2> })`; open a child
  `ScopeBuilder` seeded with the params (each param a `SymbolInfo`, per-param
  span from Task 1) and walk the body in that scope so `ma`/`n`/`length`
  resolve. Discard the child scope after the body walk (params are not visible
  outside) — mirror the existing block-scope discipline.
- Extend the `SymbolKind` union (`src/semantic/types.ts`) — today
  `"variable" | "var-variable" | "varip-variable" | "for-iterator" |
  "function-parameter" | "builtin"` — to **add `| "function"`** (there is no
  `"function"` member yet). Then extend `SymbolInfo` with the optional
  `params?: readonly string[]` and `stateful?: boolean` fields; `handleType`
  stays `null` for UDF symbols (a function is not a drawing handle).
  `types.ts` is coverage-excluded declarations.
- Register UDFs in a **first pass** over top-level statements BEFORE walking
  call sites, so a call appearing before the decl (Pine allows forward use
  within scope rules — confirm against Pine semantics; if Pine requires
  declare-before-use, keep source order and let a forward ref be
  `unknown-identifier`). Default: pre-register all top-level UDFs (hoist) to be
  permissive, and document it.

### 2. Transitive statefulness (computed in the semantic pass)

- Compute statefulness **in the semantic pass** and **store** the resolved
  `stateful: boolean` on each UDF symbol; Tasks 3–4 (and the loop-unroll
  consumer) READ it, never re-derive it.
- **Do NOT import `src/transform/statefulNames.ts` into `src/semantic/`** — the
  transform layer already depends on the semantic result, so a semantic→transform
  import is a circular dependency. The semantic pass needs a *builtin*
  stateful-primitive predicate (`ta.*`/`state.*`/`plot`/`hline`/`alert`/`draw.*`);
  if that predicate must be shared with the existing transform-layer detector,
  factor it into a **neutral module** both layers import (e.g.
  `src/semantic/statefulness.ts` or a `mapping/`-level table), rather than
  reaching across the layer boundary.
- A call whose callee resolves to a `kind: "function"` symbol contributes that
  symbol's `stateful` flag. Because the value can depend on a not-yet-classified
  UDF, compute the whole set as a **fixpoint** over the call graph:
  1. seed each UDF `stateful = <builtin-stateful-predicate over its body>`,
  2. iterate: a UDF becomes stateful if it calls any stateful UDF,
  3. repeat until no change (bounded by UDF count; a self/mutually-recursive
     cycle that is otherwise pure stays pure, but recursion itself is rejected
     — see §3).
- The transform layer's existing builtin `callIsStatefulPrimitive` semantics
  must not regress (the loop-unroll consumer); UDF-awareness lives on the
  resolved symbol's `stateful` flag, so the builtin path is unchanged when no
  UDF is involved.

### 3. Recursion detection (reject)

- After building the call graph, detect a cycle (a UDF transitively calls
  itself). Emit `udf-recursive-rejected` (error) on the **cycle's head UDF**
  (the first member in lexical order) — Pine forbids unbounded recursion and
  chartlang cannot inline a cycle. Recovery: treat that UDF as a no-op symbol
  (registered, `stateful: true`, empty `params`) so downstream call sites don't
  cascade `unknown-identifier`.

### 4. Diagnostics (`src/diagnostics/codes.ts`, append-only)

Append (namespaced `pine-converter/semantic/…`):
- `udf-arity-mismatch` (warning) — call arg count ≠ param count.
- `udf-recursive-rejected` (error) — recursive UDF.

### 5. Tests (`src/semantic/analyze.test.ts` + synthetic)

- A UDF symbol is registered with params; a call resolves (no
  `unknown-identifier`); arity mismatch warns.
- Pure UDF classifies `stateful: false`; a UDF containing `ta.ema` →
  `stateful: true`; a pure UDF calling a stateful UDF → `stateful: true`
  (transitive fixpoint).
- Param references resolve inside the body; the same name outside the body
  resolves to the outer symbol (scope isolation).
- A recursive UDF emits `udf-recursive-rejected`.
- Defensive arms unreachable from real parser output covered by synthetic-AST
  tests (the `*.synthetic.test.ts` precedent).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/semantic/analyze.ts` | Modify | `walkFunctionDeclaration`; body scope; UDF call resolution; statefulness fixpoint + recursion check. |
| `packages/pine-converter/src/semantic/types.ts` | Modify | Add `"function"` to `SymbolKind`; `SymbolInfo` `params?` + `stateful?`. |
| `packages/pine-converter/src/semantic/statefulness.ts` | Create (if shared) | Neutral builtin stateful-primitive predicate importable by both `semantic/` and `transform/` without a cycle. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Append `udf-arity-mismatch`, `udf-recursive-rejected`. |
| `packages/pine-converter/src/semantic/analyze.test.ts` | Modify | Registration / resolution / statefulness / recursion coverage. |
| `packages/pine-converter/CLAUDE.md` | Modify | Document UDF symbols, the hoist-vs-source-order decision, and the transitive-statefulness fixpoint. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (coverage **100%**)

## Changeset

Covered by Task 5's feature changeset.

## Acceptance Criteria

- Every Trend Wizard `cf_*` declaration registers a function symbol; their
  call sites resolve with no `unknown-identifier`.
- `cf_limit`/`format_trend_text`/`get_dynamic_color` classify **pure**; the
  `ta.*`-bearing helpers (`cf_slope`, `cf_dist`, `cf_ma`, `cf_macross`,
  `cf_atr_perct`, `cf_tab_*`) classify **stateful**; transitivity holds.
- Recursive UDFs reject; arity mismatches warn.
- Converter semantic coverage stays 100%.
