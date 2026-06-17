# Task 4 — Pine v6 parser: expressions + history op + UDT reject — Validated Plan

## Context

Replace the Task 3 expression stub (`src/parser/expression-stub.ts`,
`parseExpression(ctx) → UnknownExpression`) with a real Pratt /
precedence-climbing expression parser, expand the `ExpressionNode` union
(`src/ast/expressions.ts`) with the full operator/call/member/history/
ternary/tuple/lambda grammar, add an `unparse` round-trip helper
(`src/parser/unparse.ts`) for the property test, and add top-level
hard-reject branches for UDT (`type`), `method`, and library `import`
declarations. Everything stays package-internal — nothing new is
re-exported from `src/index.ts`.

## Pre-existing work (verified against workspace)

- **`parseExpression(ctx: ParserContext): ExpressionNode`** lives in
  `src/parser/expression-stub.ts`. Importers (verified): `declarations.ts`
  (`parseArgumentList`), `statements.ts` (variable decl initializer,
  assignment value, if/for/switch/return). Both import
  `from "./expression-stub.js"`. **The entry signature `(ctx) =>
  ExpressionNode` is the stable seam** — I keep it identical and just swap
  the module path to `./expressions.js`.
- **AST node modules are pure `export type` (zero runtime)** and excluded
  from coverage in `vitest.config.ts` (`src/ast/spans.ts`,
  `expressions.ts`, `statements.ts`, `script.ts`). Expanding
  `expressions.ts` adds only types → still zero runtime → no coverage
  impact.
- **`spanBetween(start, end)`** (`src/parser/spans.ts`) composes parent
  spans from child spans — used to keep span-containment by construction.
- **Lexer token model (verified in `lex.ts`):**
  - Operators are `operator` tokens: `== != <= >= := => + - * / % < > ? : =`.
    `and`/`or`/`not` are **`keyword`** tokens (in `PINE_V6_KEYWORDS`), not
    operators.
  - Brackets/`.`/`,` are `punctuation` tokens: `[ ] ( ) { } , .`.
  - `na`, `true`, `false` are **`keyword`** tokens.
  - `int`/`float`/`string`/`color` are their own token kinds; the
    `LiteralKind` union (`"int" | "float" | "bool" | "string" | "color" |
    "na"`) already exists in `expressions.ts`.
- **Existing diagnostic codes** (`diagnostics/codes.ts`):
  `unsupported-pine-version`, `missing-version-directive`,
  `unsupported-strategy`, `unsupported-library`, `unsupported-for-in`,
  `unsupported-while`, `expected-token`, `unexpected-token`.
  `makeDiagnostic(key, span, messageOverride?)` is the only construction
  path; `codes.ts` is covered (100%).
- **`import` / `type` / `method` are `keyword` tokens** and currently fall
  into `parseKeywordStatement`'s `default` arm → `unexpected-token`. The
  existing test `parse.test.ts:255` (`import foo` → `unexpected-token`)
  must be retargeted to a still-unexpected keyword and replaced with the
  new `unsupported-library-import` expectation.
- **`while` reject** already sits in `parseKeywordStatement` next to
  `for`/`switch` via `recoverCompound` (Task 3). Requirement §9 is already
  satisfied; I add a confirming test only, no code change.

## Issues found / resolved

1. **Task says "Create `src/parser/expressions.ts`" but the stub is
   `expression-stub.ts`.** Resolution: create the real parser as
   `src/parser/expressions.ts`, re-point the two importers
   (`declarations.ts`, `statements.ts`) to it, then DELETE
   `expression-stub.ts` and `expression-stub.test.ts`. No dead
   `UnknownExpression`-only path remains; the `UnknownExpression` node
   stays in the union as an unrecoverable-span fallback (emitted when the
   prefix parser cannot start an expression), and is covered by a test.
2. **§7 claims Task 3's `Assignment` has `target: ExpressionNode`.** FALSE
   against the workspace — Task 3 built `Assignment { name: string; value:
   ExpressionNode }` (verified in `ast/statements.ts`). Retrofitting a
   tuple LHS into `Assignment` would break Task 3's statement parser and
   tests, and multi-return destructuring is a Task 5 semantic concern.
   Resolution: **do not touch `Assignment`.** `TupleExpression` still lands
   in the expression union (so `(a, b)` parses at expression position);
   wiring tuple LHS into assignments is explicitly deferred to Task 5.
   Noted in CLAUDE.md append.
3. **`and`/`or`/`not` are keywords, not operators.** The precedence table
   (§2 rows 2/3/8) must match on `keyword` token text, not `operator`.
   Resolution: the binary/unary dispatch keys on `(kind, text)` pairs so
   `or`/`and` (keyword) and `==`/`+`/… (operator) and `not` (keyword
   prefix) all route correctly.
4. **`na`/`true`/`false` are keywords.** Prefix parser recognizes them:
   `na` → `NaExpression`; `true`/`false` → `LiteralExpression { literalKind:
   "bool" }`.
5. **History `[` vs subscript:** Pine's only postfix `[` is the history
   operator. Parsed at precedence 9, left-assoc, chainable (`x[1][2]`).
   `offset` is any expression (literal-bound enforcement is Task 5/8).
6. **`chart.point.*` / `ta.ema(...)`** need no special node — a member
   chain (`MemberAccessExpression { chain: string[]; head: null; call:
   CallExpression | null }`) followed by a call. Per §4, when the chain
   starts at an identifier `head` is `null` and the dotted names accumulate
   into `chain`; a trailing `(...)` attaches as `call`.
7. **Coverage:** new runtime modules `expressions.ts` + `unparse.ts` must
   hit 100% line/branch/function. Every prefix kind, every precedence
   level, both arg forms, the `mixed-named-positional-args` branch, the
   `chained-ternary-warning` branch, and the `UnknownExpression` fallback
   need a covering test.
8. **`docs:check`:** every new `@example` must typecheck. Examples build
   plain object literals (no `defineIndicator`, so no compiler execution),
   matching the Task 3 precedent.

## Improvements

- Single `parsePrimary` / `parsePrefix` / `parseBinary(minPrec)` split with
  one `INFIX` precedence table (a `ReadonlyMap`) so adding an operator is a
  one-row change — no scattered precedence literals.
- `unparse` is a thin, total AST→text emitter reused only by the property
  test; it lives in `src/parser/unparse.ts` (covered) and is exercised
  exhaustively by the round-trip property plus targeted unit tests for
  every node kind so it reaches 100% without the property's randomness
  being load-bearing for coverage.

## AST union (final, `src/ast/expressions.ts`)

```
ExpressionNode =
  | IdentifierExpression        (existing)
  | LiteralExpression           (existing; literalKind incl "bool")
  | NaExpression                (new) { kind:"na-expression" }
  | UnaryExpression             (new) { operator:"+"|"-"|"not"; operand }
  | BinaryExpression            (new) { operator:string; left; right }
  | TernaryExpression           (new) { condition; consequent; alternate }
  | CallExpression              (new) { callee; args: CallArgument[] }
  | MemberAccessExpression      (new) { head: ExpressionNode|null; chain: string[] }
  | HistoryAccessExpression     (new) { receiver; offset }
  | ParenExpression             (new) { expression }
  | TupleExpression             (new) { elements: ExpressionNode[] }
  | LambdaExpression            (new) { params: string[]; body }
  | UnknownExpression           (existing; unrecoverable fallback)

CallArgument = WithSpan & { name: string | null; value: ExpressionNode }
```

`callee` of `CallExpression` is the `MemberAccessExpression` /
`IdentifierExpression` being called (member chain already carries the
`ta.ema` dotted name; the call wraps it). This keeps §6 `chart.point.new`
as `Call(callee=Member(chain:["chart","point","new"]), args:[...])`.

## Diagnostic codes added (`diagnostics/codes.ts`)

- `unsupported-udt` (error) — `type Name` block.
- `unsupported-method` (error) — `method ...` block.
- `unsupported-library-import` (error) — `import lib/Identifier`.
- `mixed-named-positional-args` (error) — a positional arg follows a named
  arg in a call.
- `chained-ternary-warning` (info → severity `"info"`) — a ternary whose
  `alternate` is itself a ternary.

Verify `DiagnosticSeverity` includes `"info"` (it must, for the warning).
If only `error|warning` exist, downgrade to `warning` and note it. (Checked
at implementation time against `src/index.ts`.)

## Numbered steps (verified paths)

1. `src/ast/expressions.ts` — replace with the full union above; JSDoc
   (`@example`/`@since 0.1`/`@experimental`) on every member. Pure type,
   no runtime.
2. `src/diagnostics/codes.ts` — add the five codes to `DIAGNOSTIC_CODES`.
3. `src/parser/expressions.ts` — CREATE the Pratt parser exporting
   `parseExpression(ctx: ParserContext): ExpressionNode` (same signature as
   the stub): `parseExpression` → `parseTernary` → `parseBinary(minPrec)`
   → `parsePrefix` → `parsePostfix` (call `(`, history `[`, member `.`) →
   `parsePrimary` (ident/literal/na/bool/paren/tuple/lambda). Named-arg +
   `mixed-named-positional-args` handling in `parseCallArgs`.
   `chained-ternary-warning` emitted in `parseTernary`. `UnknownExpression`
   fallback when `parsePrimary` cannot start.
4. `src/parser/unparse.ts` — CREATE `unparse(node: ExpressionNode): string`
   total over the union, for the round-trip property.
5. `src/parser/declarations.ts` — change the one import from
   `./expression-stub.js` → `./expressions.js`.
6. `src/parser/statements.ts` — change the one import from
   `./expression-stub.js` → `./expressions.js`.
7. `src/parser/statements.ts` — add `type` and `method` cases to
   `parseKeywordStatement` (emit `unsupported-udt` / `unsupported-method`,
   then `recoverCompound`), and an `import` case (emit
   `unsupported-library-import`, then `recoverLine`). `while` stays as-is.
8. DELETE `src/parser/expression-stub.ts` and `expression-stub.test.ts`.
9. Tests (create): `expressions.test.ts`, `expressions.property.test.ts`,
   `parse-udt-reject.test.ts`, `history-op.test.ts`. Modify
   `parse.test.ts` (retarget the `import foo` test).
10. `.changeset/pine-converter-parser-expressions.md` — patch.
11. Append "Parser / expressions" section to
    `packages/pine-converter/CLAUDE.md`.

## Files to create / modify

| File | Action |
|------|--------|
| `src/ast/expressions.ts` | replace (full union, pure type) |
| `src/diagnostics/codes.ts` | modify (5 codes) |
| `src/parser/expressions.ts` | create (Pratt parser) |
| `src/parser/unparse.ts` | create (round-trip helper) |
| `src/parser/declarations.ts` | modify (import path) |
| `src/parser/statements.ts` | modify (import path + udt/method/import branches) |
| `src/parser/expression-stub.ts` | delete |
| `src/parser/expression-stub.test.ts` | delete |
| `src/parser/expressions.test.ts` | create |
| `src/parser/expressions.property.test.ts` | create |
| `src/parser/parse-udt-reject.test.ts` | create |
| `src/parser/history-op.test.ts` | create |
| `src/parser/parse.test.ts` | modify (retarget import test) |
| `.changeset/pine-converter-parser-expressions.md` | create |
| `packages/pine-converter/CLAUDE.md` | append section |

Do NOT touch `src/lexer/`, `src/mapping/`, `src/index.ts`, `vitest.config.ts`.

## Gates

- `pnpm --filter @invinite-org/chartlang-pine-converter typecheck`
- `pnpm --filter @invinite-org/chartlang-pine-converter test` (100% cov)
- `pnpm lint` (Biome) on touched files
- `pnpm docs:check` (every `@example` typechecks)

## Changeset

`.changeset/pine-converter-parser-expressions.md` — `patch` on
`@invinite-org/chartlang-pine-converter`.

## Acceptance checklist

- [ ] `ta.ema(close, 9)[3]` → `HistoryAccess(Call(Member))`.
- [ ] Every precedence level + associativity covered by a golden test.
- [ ] Positional + named args; `mixed-named-positional-args` on misuse.
- [ ] `na`, bool/int/float/string/color literals.
- [ ] member depth ≥ 3 (`a.b.c`), history depth ≥ 2 (`x[1][2]`).
- [ ] UDT/method/import emit their codes and the next statement parses
      cleanly.
- [ ] property: 100 random expressions parse→unparse→re-lex→parse equal
      modulo span; every node's span ⊆ parent.
- [ ] 100% coverage on `expressions.ts` + `unparse.ts`.
- [ ] stub module + test deleted; importers re-pointed.
- [ ] changeset + CLAUDE.md append landed.
