# Task 1 — Parser + AST: Pine function declarations (`name(params) => …`)

> **Status: TODO**

## Goal

Add a first-class `FunctionDeclaration` statement to the converter's AST and
teach the parser to recognize Pine **user-defined function declarations** in
both forms — single-line (`f(a, b) => expr`) and multi-line (a `=>` followed by
an indented block whose last expression is the implicit return). Today neither
form parses: the declaration is mis-read as a bare call expression and the
`=> body` is dropped. This task is parse-only — it produces the AST node the
semantic (Task 2) and transform (Tasks 3–4) stages consume; it emits nothing.

## Prerequisites

None. (Tasks 2–5 build on this.)

## Current Behavior

- `parseStatement` (`packages/pine-converter/src/parser/statements.ts:511`)
  has no recognizer for a `name(params) => body` declaration. A line like
  `cf_slope(ma, n) => ta.ema(...)` parses as an **expression statement**
  whose expression is the call `cf_slope(ma, n)`; the trailing `=> ...` then
  becomes an `unexpected-token` (multi-line) or a dropped tail (single-line).
- A `LambdaExpression` IS parsed, but only via `parseParenOrTupleOrLambda`
  (`src/parser/expressions.ts:141`) when a line **starts** with `(`. A Pine
  decl starts with the function NAME, so the lambda path never triggers.
  `LambdaExpression` is a **structural reference only** here (the `params` +
  `body` shape) — a Pine UDF *declaration* (`name(params) => body`) is a NEW
  **statement** parse path added by this task, distinct from and not routed
  through the lambda *expression* parser.
- The AST statement union (`src/ast/statements.ts`) has no
  `function-declaration` kind. Existing kinds: `block-statement`,
  `variable-declaration`, `assignment`, `if-statement`, `for-statement`,
  `switch-statement`, `break`/`continue`/`return`, `tuple-declaration`,
  `expression-statement`.
- Significant indentation already produces `indent`/`dedent` tokens and
  `parseBlock` opens/closes a `BlockStatement` on them (see
  `packages/pine-converter/CLAUDE.md` §Parser) — the multi-line body reuses
  this.

## Desired Behavior

```pine
// single-line
cf_slope(ma, n) => ta.ema(((ma - ma[1]) / ma[1] * 100), n)

// multi-line (implicit return = last expression)
cf_atr(length) =>
    atr = ta.atr(length)
    atr_prct = (atr / close) * 100
```

both parse to:

```ts
{
  kind: "function-declaration",
  name: "cf_slope",                       // identifier
  params: [{ name: "ma", span }, { name: "n", span }],
  body: <BlockStatement>,                 // single-line wraps the expr in a 1-stmt block
  span,
}
```

A standalone call `cf_slope(e, 2)` (no `=>`) still parses as today (an
expression statement / assignment RHS) — only the `… ) =>` shape is a decl.

## Requirements

### 1. AST node (`src/ast/statements.ts`)

Add a pure `export type FunctionDeclaration` (deeply `readonly`, kebab `kind`,
1-based `span`, the established node shape):

```ts
export type FunctionParam = WithSpan & Readonly<{ name: string }>;
export type FunctionDeclaration = WithSpan & Readonly<{
    kind: "function-declaration";
    name: string;
    params: readonly FunctionParam[];
    body: BlockStatement;     // single-line: a 1-statement block (return expr)
}>;
```

Add it to the `Statement` union. `src/ast/statements.ts` is `export type`-only
and coverage-excluded — no runtime here. Per-param spans (like
`TupleDeclaration.names`) so Task 2's `symbols` map gets one entry per param
with no span collision.

### 2. Recognize the declaration head (`src/parser/statements.ts`)

In `parseStatement`, before falling through to the expression/assignment path,
detect the decl head with bounded lookahead (`TokenCursor.peekAhead`, the same
mechanism that disambiguates named args and `for … in`): an
`identifier` followed by `(`, a balanced parameter list of comma-separated
identifiers, `)`, then `=>`. Only that exact shape is a `FunctionDeclaration`;
anything else (e.g. `ident ( args ) [` history, `ident ( args )` call) routes
to the existing path unchanged.

- Parse the parameter list as bare identifiers (Pine UDF params are untyped in
  v1). A **typed param** `float x` → push a `udf-typed-param-unsupported`
  (warning) and treat it as the bare name `x`; the UDF still parses and emits
  (chosen for v1 so a typed-param helper still converts). A **default-valued
  param** (`f(x, y = 2) =>`) is **rejected** in v1: push
  `udf-param-default-unsupported` (error) and **skip the whole UDF** (the
  recognizer recovers the decl line/block, registers no `FunctionDeclaration`).
  No `default` field is added to `FunctionParam` in v1 (it stays
  `{ name, span }` — see §1); record this decision in CLAUDE.md.

### 3. Parse the body (single- + multi-line)

- **Single-line** (`=> expr` on the same logical line): parse one
  `parseExpression`, wrap it in a synthetic 1-statement `BlockStatement` whose
  sole statement is an `expression-statement` (the implicit return). Mark it so
  Task 3/4 know the block's last expression is the return value (the convention
  is "last statement of body is the return"; no explicit return node needed —
  Pine has none).
- **Multi-line** (`=>` then `newline indent … dedent`): reuse `parseBlock` to
  read the indented block. The block's **last** statement is the implicit
  return; intermediate `x = expr` lines are local `Assignment`s (Task 3/4 lower
  them to `const`/`let` locals).

### 4. Diagnostics (`src/diagnostics/codes.ts`, append-only)

Append (no reorder), namespaced `pine-converter/parse/…`:
- `udf-typed-param-unsupported` (warning) — a typed UDF param; treated as bare.
- `udf-param-default-unsupported` (error) — a defaulted UDF param (v1 reject).

Per the repo invariant, codes are the stable public contract — append only,
never rename/reorder. `code-coverage-grep.test.ts` walks every
`makeDiagnostic`/`pushCode` literal, so registering the keys keeps it green.

### 5. Recovery (never throw)

A malformed decl (`f(a,) =>`, `f(1+2) =>` non-identifier param, missing `)`)
emits a `ParserDiagnostic` and recovers via the existing line/block recovery
(`recoverLine` / `recoverCompound`) so parsing resumes at the next sibling —
the parser-never-throws invariant.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/ast/statements.ts` | Modify | Add `FunctionDeclaration` + `FunctionParam` + union member. |
| `packages/pine-converter/src/parser/statements.ts` | Modify | Recognize `name(params) =>` head; parse params + single/multi-line body. |
| `packages/pine-converter/src/parser/unparse.ts` | Modify | Emit the decl form so `unparse∘parse` reaches a fixpoint (property test). |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Append `udf-typed-param-unsupported`, `udf-param-default-unsupported`. |
| `packages/pine-converter/src/parser/statements.test.ts` | Modify | Decl-head recognition, single/multi-line bodies, recovery, non-decl call still parses. |
| `packages/pine-converter/CLAUDE.md` | Modify | Document the new statement form + the typed-param / param-default decisions. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (coverage **100%**;
  parser-unreachable arms covered by synthetic-token unit tests, the
  established precedent)

## Changeset

Covered by Task 5's feature changeset (`pine-converter` minor) — this task
adds no public package surface on its own.

## Acceptance Criteria

- `cf_slope(ma, n) => ta.ema(...)` and the multi-line `cf_atr(length) => …`
  both parse to a `FunctionDeclaration` with correct params + body block; the
  body's last statement is the implicit return.
- A standalone `cf_slope(e, 2)` call still parses unchanged (no false-positive
  decl detection).
- Malformed decls recover without throwing; the two new diagnostics fire on
  typed / defaulted params.
- Converter parser coverage stays 100%.
