# Task 2 — Parser: value-position `[…]` array literals

> **Status: TODO**

## Goal

Teach the Pratt parser to parse a square-bracket **array literal in value
position** (`["SMA", "EMA"]`, `[high, low]`) so a `[…]` appearing as a
named-arg value, call argument, or RHS no longer breaks parsing. Today `[` is
only handled as a postfix history-access operator, so any value-position
`[…]` produces `expected-token` / `unexpected-token`.

## Prerequisites

None. (This task unblocks T4 Task 3 / Task 4 and is coordinated with T5's
`[high, low]` source-list arg — T5 depends on this parser change.)

## Current Behavior

- `packages/pine-converter/src/parser/expressions.ts` is a Pratt parser. `[`
  is wired **only** as a precedence-9 postfix `history-access-expression`
  (`receiver[offset]`) via `parsePostfix`. There is no prefix/primary rule
  that opens a `[` as a literal array.
- A statement-leading `[ ident (, ident)* ] =` is recognized separately as a
  `TupleDeclaration` (`src/parser/statements.ts`, `looksLikeTupleDeclaration`)
  — destructuring, **not** a value array.
- Result: `input.string("EMA", options=["SMA","EMA"])` fails at the `[` —
  `pine-converter/parse/expected-token` then `unexpected-token`, and the first
  element leaks as a statement (see T4 README evidence).

## Desired Behavior

```pine
x = [1, 2, 3]                               // value-position array literal
sel = input.string("EMA", options=["SMA","EMA"])  // named-arg value
```

parse to an `ArrayLiteralExpression { elements: ExpressionNode[] }` AST node
(elements parsed via `parseExpression`), with no diagnostics. The existing
`a[0]` history-access and `[a, b] = …` tuple-declaration forms are unchanged.

## Requirements

### 1. AST node (`src/ast/expressions.ts`)

- Add `ArrayLiteralExpression` — `{ kind: "array-literal-expression";
  elements: readonly ExpressionNode[]; span: SourceSpan }`. Pure `export type`
  (the `ast/*.ts` modules are zero-runtime, coverage-excluded).

### 2. Prefix/primary rule (`src/parser/expressions.ts`)

- In the primary dispatch (where `(` opens
  `parseParenOrTupleOrLambda`), add a `[`-prefix rule
  `parseArrayLiteral(ctx, open)`: consume `[`, parse a comma-separated
  `parseExpression` list, close on `]` via `ctx.cursor.match("punctuation",
  "]")`, allow an empty `[]` and a trailing comma, build
  `ArrayLiteralExpression` with `spanBetween(open, close)`.
- **Disambiguation — there are THREE distinct `[` contexts; keep them
  separate:** (a) a **statement-leading** `[ ident (, ident)* ] =` is the
  existing `TupleDeclaration` (`statements.ts`, `looksLikeTupleDeclaration`) —
  destructuring, untouched; (b) an **expression-position postfix** `[` (a left
  operand present, e.g. `a[0]`) stays the precedence-9 history-access in
  `parsePostfix` — untouched; (c) the **NEW** expression-position **prefix**
  `[` (no left operand — at a statement-value start, or after `=`/`(`/`,`/a
  binary operator) is the array literal. The Pratt structure already separates
  prefix from postfix — do **not** touch `parsePostfix`. Confirm `a[0]` still
  lowers to `history-access-expression` and `[a,b] = …` is still a
  `TupleDeclaration` (regression tests).
- **Never throw:** if the closing `]` is missing, `ctx.cursor.match` returns
  null — recover via a zero-width `UnknownExpression` at the `[` span (the
  established boundary-recovery contract; the boundary token is left in place so
  the statement layer's empty-expression check resumes), do not consume to EOF.

### 3. Downstream emit (`src/transform/exprEmit.ts`)

- Add an `array-literal-expression` arm to `emitExpr`:
  `[${elements.map(emitExpr).join(", ")}]`. (Mirrors the existing
  `tuple-expression` arm.) This keeps any non-input consumer that meets an
  array literal emitting valid TS rather than `undefined`.

### 4. `unparse` (`src/parser/unparse.ts`)

- Add the `array-literal-expression` case so the property test's
  `unparse∘parse` re-lex fixpoint holds (emit `[e0, e1, …]`).

### 5. Semantic walk (`src/semantic/analyze.ts`, `qualifiers.ts`,
`statefulNames.ts`)

- Add an `array-literal-expression` arm wherever `tuple-expression` is walked
  (walk every element) so symbols/qualifiers resolve inside array literals and
  no walker hits an unhandled node kind.

### 6. Tests

- Parser unit + property tests (co-located): value array in RHS, named-arg
  value, call arg, empty `[]`, trailing comma, nested `[[1],[2]]`; **regression**
  asserting `a[0]` is still `history-access-expression` and `[a,b]=x` is still
  a `TupleDeclaration`.
- `unparse` property fixpoint includes an array-literal case.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/ast/expressions.ts` | Modify | `ArrayLiteralExpression` node type. |
| `packages/pine-converter/src/parser/expressions.ts` | Modify | `[`-prefix array-literal rule + disambiguation. |
| `packages/pine-converter/src/parser/expressions.test.ts` | Modify | Parser unit/property + regressions. |
| `packages/pine-converter/src/parser/unparse.ts` | Modify | `array-literal-expression` case. |
| `packages/pine-converter/src/transform/exprEmit.ts` | Modify | Emit `[…]`. |
| `packages/pine-converter/src/semantic/analyze.ts` | Modify | Walk array elements. |
| `packages/pine-converter/src/semantic/qualifiers.ts` | Modify | Qualifier arm. |
| `packages/pine-converter/src/semantic/statefulNames.ts` | Modify | Stateful-walk arm. |
| `.changeset/converter-array-literal.md` | Create | minor (pine-converter; may be the shared T4 changeset). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% line/branch/function on pine-converter)
- `pnpm docs:check`

## Changeset

`.changeset/converter-array-literal.md` — **minor**
(`@invinite-org/chartlang-pine-converter`) — new converter surface (array-literal
parsing). May be folded into one shared T4 pine-converter **minor** changeset
across Tasks 2–4.

## Acceptance Criteria

- A value-position `[…]` array literal parses with zero diagnostics across RHS,
  named-arg, and call-arg positions.
- `a[0]` history-access and `[a, b] = …` tuple-declaration are byte-identical
  to before (regression goldens).
- 100% coverage held; parser never throws on an unterminated `[`.
