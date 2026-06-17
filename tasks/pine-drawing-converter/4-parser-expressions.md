# Task 4 — Pine v6 parser: expressions + history operator + UDT reject

> **Status: TODO**

## Goal

Replace Task 3's `UnknownExpression` stub with a full Pine v6 expression
parser: precedence-climbing for binary operators, prefix unary,
function-call expressions (positional + named args), member access
(`a.b.c`), the history operator (`x[n]`), ternary (`?:`), `na`,
boolean/string/numeric/color literals, and the `chart.point.*` factory
calls. Additionally, recognize Pine v6's UDT (`type Name`) and method
(`method ...`) declarations and emit the canonical hard-reject
diagnostics so the rest of the pipeline can rely on "no UDT/method nodes
exist downstream".

## Prerequisites

Task 3 (parser scaffold + statement grammar + `UnknownExpression`
seam).

## Current Behavior

`parseExpression()` in `src/parser/expressions.ts` (created in Task 3 as
a stub) captures tokens up to a statement boundary and returns an
`UnknownExpression`. UDT and method declarations are silently absorbed
because no top-level recognizer exists for them.

## Desired Behavior

`parseExpression()` returns a fully-typed expression AST built from the
expanded `ExpressionNode` union. The script grammar (Task 3) gains a
new alternative at the top level for UDT and method declarations that
immediately emits a hard-reject diagnostic and skips the body.

## Requirements

### 1. Expanded `ExpressionNode` union (`src/ast/expressions.ts`)

```ts
export type ExpressionNode =
    | IdentifierExpression
    | LiteralExpression
    | NaExpression
    | UnaryExpression
    | BinaryExpression
    | TernaryExpression
    | CallExpression
    | MemberAccessExpression
    | HistoryAccessExpression       // x[n]
    | ParenExpression
    | TupleExpression               // (a, b)  — Pine's only multi-value form
    | LambdaExpression              // (x) => x + 1  — used in `array.map` style; rejected for v1
    | UnknownExpression;            // kept for unrecoverable spans
```

Each node has a `span: SourceSpan` and a string discriminator. Literal
kinds: `"int" | "float" | "bool" | "string" | "color"`.

### 2. Precedence table

Pine v6's operator precedence (lowest → highest):

| Precedence | Operators | Associativity |
|---|---|---|
| 1 | `? :` (ternary) | right |
| 2 | `or` | left |
| 3 | `and` | left |
| 4 | `==` `!=` | left |
| 5 | `<` `<=` `>` `>=` | left |
| 6 | `+` `-` | left |
| 7 | `*` `/` `%` | left |
| 8 | unary `+` `-` `not` | right |
| 9 | `[` (history), `(` (call), `.` (member) | left |

Implement via precedence-climbing (`parseExpressionWithPrecedence(min)`)
in `src/parser/expressions.ts`. The history operator `[` is parsed as a
postfix at precedence 9.

### 3. Function-call arguments

`a(x, y, named=z)` — positional must precede named. Build a
`CallExpression` with `args: readonly CallArgument[]` where
`CallArgument = { name: string | null; value: ExpressionNode }`. Track
the span of each argument.

### 4. Member access

`a.b.c` → left-associative `MemberAccessExpression`. Identifier chain
captured as `chain: readonly string[]` plus the head expression — the
common `ta.ema(close, 9)` case stores `chain: ["ta", "ema"]`, `head:
null`, `call: { ... }`. Use `head` only when the receiver is itself an
expression (e.g. `arr.get(0)` where `arr` is computed) — for v1, the
parser uses `head: null` whenever the chain starts at an identifier.

### 5. History operator

`x[n]` parses to `HistoryAccessExpression { receiver: ExpressionNode,
offset: ExpressionNode }`. `n` may be any expression (Task 5/8 enforce
literal-bound semantics for the chartlang-emit constraint). Chained
history (`x[1][2]`) is allowed and left-associative.

### 6. `chart.point.*` recognition

Recognize the v6 anchor-factory calls as ordinary `CallExpression`s
with a member-access chain — no special AST node. The transform layer
(Task 7) destructures `chart.point.new(time, index, price)`,
`chart.point.now(price)`, `chart.point.from_index(index, price)`,
`chart.point.from_time(time, price)`, `chart.point.copy(id)` by chain
match.

### 7. Tuples

`(a, b)` at expression position → `TupleExpression`. Pine uses tuples
for multi-return functions (e.g. `[k, d] = ta.stoch(...)`). The
left-hand side of a multi-return assignment is parsed as a tuple of
identifiers — represented in Task 3's `Assignment` node already as
`target: ExpressionNode`, where Task 4's expression parser handles the
LHS as `TupleExpression` of `IdentifierExpression`s.

### 8. Hard-reject: UDT and method declarations

Augment the top-level statement loop in `src/parser/parse.ts` (added in
Task 3):

- `type Identifier NEWLINE INDENT FieldDecl+ DEDENT` →
  `unsupported-udt` diagnostic, span covers entire block, statement
  dropped.
- `method Identifier "(" ... ")" NEWLINE INDENT ... DEDENT` →
  `unsupported-method` diagnostic, span covers entire block, dropped.
- `import lib/Identifier` → `unsupported-library-import` diagnostic.

After emitting the diagnostic, consume tokens up to and including the
matching DEDENT so the next top-level statement parses cleanly.

### 9. Hard-reject: `while` loop

Already added in Task 3 as a recovery branch — confirm here it sits at
the same place as `for`/`switch` and emits `unsupported-while`.

### 10. Lambda + array-method reject

Lambda expressions (`(x) => expr`) parse to a `LambdaExpression` node
but the **transform layer** rejects them (not the parser). Reasoning:
keep parser surface-faithful so that later passes can detect them in
context (e.g. `arr.map(x => x*2)` becomes a single transform-time
reject for `array.map` use).

### 11. Diagnostic codes (added this task)

- `unsupported-udt` (error)
- `unsupported-method` (error)
- `unsupported-library-import` (error)
- `mixed-named-positional-args` (error) — named arg precedes positional
- `chained-ternary-warning` (info) — chained `a ? b : c ? d : e`; not
  rejected, but flagged because the chartlang codegen prefers
  if/else.

### 12. Tests (§16.3)

| File | Purpose |
|------|---------|
| `expressions.test.ts` | Operator-precedence golden tests (every level), unary, function calls (positional + named), member access depth ≥ 3, history depth ≥ 2, ternary, `na`, every literal kind. |
| `expressions.property.test.ts` | Property: every parsed expression's span is contiguous and ⊆ its parent statement's span. Property: lex → parse → AST-stringify (a simple `unparse` helper in `src/parser/unparse.ts`) → re-lex → parse → AST-equal modulo span. |
| `parse-udt-reject.test.ts` | UDT and method blocks emit the right diagnostics and don't pollute the next statement. |
| `history-op.test.ts` | `close[1]`, `close[1][2]`, `ta.ema(close,9)[3]`, `arr[i]` (with `i` an identifier — for v1 a warning is logged by Task 5, but the parse succeeds). |

Coverage 100% on `src/parser/expressions.ts` and `src/parser/unparse.ts`.

### 13. JSDoc

Update JSDoc on the expanded `ExpressionNode` union members and the
`parseExpression` export with `@example`s. Every `@example` block must
compile.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/ast/expressions.ts` | Replace | Full `ExpressionNode` union. |
| `packages/pine-converter/src/parser/expressions.ts` | Create | Full expression parser. |
| `packages/pine-converter/src/parser/parse.ts` | Modify | Add UDT/method top-level branches. |
| `packages/pine-converter/src/parser/unparse.ts` | Create | AST → token-text round-trip helper for property tests. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Add Task-4 diagnostic codes. |
| `packages/pine-converter/src/parser/expressions.test.ts` | Create | Operator/precedence/call/member golden tests. |
| `packages/pine-converter/src/parser/expressions.property.test.ts` | Create | Span containment + round-trip. |
| `packages/pine-converter/src/parser/parse-udt-reject.test.ts` | Create | UDT/method reject tests. |
| `packages/pine-converter/src/parser/history-op.test.ts` | Create | History-operator unit tests. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm docs:check`

## Changeset

`.changeset/pine-converter-parser-expressions.md` — patch bump.

## Acceptance Criteria

- `parseStatements(lex("//@version=6\nindicator('x')\ny = ta.ema(close, 9)[3]\n"))`
  returns a `Script` whose body has one assignment whose RHS is a
  `HistoryAccessExpression` wrapping a `CallExpression` wrapping a
  `MemberAccessExpression`.
- UDT block emits `unsupported-udt` and the next statement parses
  cleanly.
- Property test: 100 random expressions parse-then-unparse to
  lex-equivalent token streams.
- 100% coverage on `src/parser/expressions.ts` and
  `src/parser/unparse.ts`.
- JSDoc + lint + typecheck gates green.
- Changeset committed.
