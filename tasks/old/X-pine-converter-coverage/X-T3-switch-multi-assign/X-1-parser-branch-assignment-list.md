# Task 1 — Parser: comma-separated assignment list as a switch/arrow branch body

> **Status: TODO**

## Goal

Teach the parser to read a **comma-separated list of assignments** as the body
of a `switch` case arm (and an arrow `=>` branch), so Pine's multi-assignment
preset pattern parses into a list of `Assignment` nodes instead of breaking on
the first comma.

## Prerequisites

None.

## Current Behavior

Pine:
```pine
switch sel
    "X" => a := 8, b := 21
    "Y" => a := 4, b := 10
```
produces `pine-converter/parse/expected-token` + 3× `unexpected-token`, and
only the first assignment per branch survives.

- Single-value `switch` parsing/lowering works (`src/transform/other.ts` +
  `src/transform/controlFlow.ts` for lowering; the switch statement itself is
  built in `src/parser/statements.ts`).
- The lexer suppresses a `newline` after a trailing `,` (the paren-depth +
  trailing-comma line-continuation rule), so `a := 8, b := 21` is ONE logical
  line. The branch-body reader parses a single assignment via
  `parseAssignment` (`src/parser/expressions.ts`) and then hits the stray `,`
  → `expected-token`.
- `parseAssignment` already consumes a name + `=`/`:=` operator + RHS and
  produces an `Assignment` node.

## Desired Behavior

A switch case arm / arrow branch body may be a single expression **or** a
comma-separated assignment list. Each assignment becomes one statement in the
branch's body block:

```
switch sel
    "X" => a := 8, b := 21, c := 50
```
parses to a branch whose body is `[Assignment(a,8), Assignment(b,21),
Assignment(c,50)]` — no diagnostics.

## Requirements

### 1. Branch-body list reader (`src/parser/statements.ts` + `expressions.ts`)

- In the `switch`/arrow branch-body parse (locate the case-arm reader in
  `src/parser/statements.ts`), after parsing the first branch element, **loop
  while the next significant token is `,`**: consume the `,` and parse the next
  element. Collect the elements into the branch body (a `BlockStatement` / the
  branch's existing body shape — reuse whatever single-value branches already
  store, widened to a list).
- Each element is parsed with the existing `parseAssignment`
  (`src/parser/expressions.ts`); a non-assignment first element (the common
  `"X" => <expr>` value form) stays a single-element body — do not regress it.
- Terminate the list on `newline`/`dedent`/`eof` (a real branch boundary), not
  on the comma.

### 2. Keep global comma semantics intact

- The comma-list reader is scoped to the **branch body** only. Tuple
  destructuring (`[a,b] = …`), call-argument commas, and array-literal commas
  must be unaffected (the change is in the branch-body production, not the
  expression Pratt parser's general comma handling).

### 3. AST + spans

- **No AST change is required: `SwitchCase.body` is already typed
  `readonly Statement[]`** (`src/ast/statements.ts`). The single-value branch
  simply populates it with one element today; this task populates it with N.
  Each element carries its own span (per-element, so the semantic
  `symbols`/lifetime maps get one entry per assignment). Compose the branch
  span from child spans via the existing `spanBetween` helper so the "child
  span ⊆ parent span" property holds.
- This is purely a **parser** change at the branch-body production
  (`parseSwitchCase`); the switch **lowering** already iterates `arm.body`
  via its `emitBody` callback (`controlFlow.ts`), so no transform change is
  needed for the iteration itself (Task 2 only verifies multi-element output).
- The parser must **never throw** — `parseStatement`/`parseAssignment` already
  recover and a `null` element is skipped (the existing
  `UnknownExpression`/empty-expression path).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/parser/statements.ts` | Modify | Branch-body comma-list reader for switch/arrow arms. |
| `packages/pine-converter/src/ast/statements.ts` | No change | `SwitchCase.body` is already `readonly Statement[]` — no widening needed. |
| `packages/pine-converter/src/parser/*.test.ts` | Modify | Parse coverage: multi-assign branch, single-value branch unchanged, malformed-element recovery. |
| `packages/pine-converter/src/parser/unparse.ts` | Modify (if needed) | `unparse∘parse` fixpoint for the list body (property-test helper). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (coverage **100%**)

## Changeset

Covered by the T3 feature changeset created in Task 2
(`@invinite-org/chartlang-pine-converter`, minor).

## Acceptance Criteria

- `"X" => a := 8, b := 21, c := 50` parses to a 3-assignment branch body with
  no diagnostics.
- Single-value `"X" => <expr>` branches and the subjectless boolean-case form
  are byte-unchanged.
- Tuple/array/call comma handling is unaffected; parser never throws; coverage
  100%.
