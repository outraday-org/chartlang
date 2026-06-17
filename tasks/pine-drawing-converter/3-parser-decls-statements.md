# Task 3 — Pine v6 parser: AST + declarations + statements

> **Status: TODO**

## Goal

Define the Pine v6 AST node vocabulary and implement the recursive-
descent parser for top-level declarations and statements: the
`//@version=6` directive, `indicator()`/`strategy()`/`library()`
declarations, `var`/`varip`/`let`-style variable declarations,
assignment / reassignment (`=` / `:=`), `if`/`else if`/`else`,
literal-bounded `for`-loops, `switch`/`case`, and break/continue/return.
Expressions are stubbed as opaque `ExpressionNode` placeholders here
and filled in by Task 4 — the seam keeps each task's spec readable.

## Prerequisites

Task 2 (lexer + token stream).

## Current Behavior

`src/parser/index.ts` and `src/ast/index.ts` are placeholders. Lexer
tokens exist but no AST or parser does.

## Desired Behavior

A package-internal `parseStatements(tokens: readonly Token[]):
ParseResult` API in `src/parser/parse.ts` that produces a Pine v6
`Script` AST node and an array of `ParserDiagnostic`s. Expression
parsing is delegated to a stub `parseExpression()` that Task 4
implements; for now, the stub consumes tokens up to the next
statement-terminating boundary and packages them into an
`UnknownExpression` node so end-to-end tests can assert top-level
structure.

## Requirements

### 1. AST nodes (`src/ast/`)

Split node types across logical files:

- `src/ast/script.ts` — `Script`, `Declaration`, `IndicatorDeclaration`,
  `StrategyDeclaration`, `LibraryDeclaration`, `ImportDeclaration`.
- `src/ast/statements.ts` — `Statement` union and members
  (`VariableDeclaration`, `Assignment`, `IfStatement`, `ForStatement`,
  `SwitchStatement`, `BreakStatement`, `ContinueStatement`,
  `ReturnStatement`, `ExpressionStatement`, `BlockStatement`).
- `src/ast/expressions.ts` — `ExpressionNode` discriminated-union
  placeholder (Task 4 expands). For now: `IdentifierExpression`,
  `LiteralExpression`, `UnknownExpression` (with `tokens: readonly
  Token[]`).
- `src/ast/types.ts` — `TypeAnnotation` (`int`, `float`, `bool`,
  `color`, `string`, `line`, `label`, `box`, `table`, `polyline`,
  `linefill`, `array<T>`, `matrix<T>`, `map<K,V>`, `series<T>`,
  `simple<T>`, `const<T>`, `input<T>`).
- `src/ast/spans.ts` — `WithSpan` mixin (every node carries `span:
  SourceSpan`).
- `src/ast/index.ts` — re-export everything.

Every AST node is `readonly`, deeply immutable, and has a string
`kind` discriminator (e.g. `kind: "indicator-declaration"`). Use
`kebab-case` for the discriminator.

### 2. Parser entry (`src/parser/parse.ts`)

```ts
export type ParseResult = Readonly<{
    script: Script;
    diagnostics: readonly ParserDiagnostic[];
}>;

export function parseStatements(tokens: readonly Token[]): ParseResult;
```

Internally use a `TokenCursor` (`src/parser/cursor.ts`) helper:
`peek()`, `next()`, `expect(kind, text?)`, `match(kind, text?)`,
`recover(stopKinds: Set<TokenKind>)`.

### 3. Top-level grammar

```
Script := VersionDirective NEWLINE* Declaration Statement*
VersionDirective := "//@version=" Int
Declaration := IndicatorDeclaration | StrategyDeclaration | LibraryDeclaration
IndicatorDeclaration := "indicator" "(" ArgumentList ")" NEWLINE
StrategyDeclaration := "strategy" "(" ArgumentList ")" NEWLINE  → reject with `unsupported-strategy` diagnostic but continue parsing body
LibraryDeclaration := "library" "(" ArgumentList ")" NEWLINE     → reject with `unsupported-library` diagnostic but continue parsing body
```

An `ArgumentList` is a comma-separated list of positional then named
arguments (`name = expression`). For Task 3, treat each argument value
as `UnknownExpression` (Task 4 substantiates).

### 4. Statement grammar

```
Statement
    := VariableDeclaration
    |  Assignment
    |  IfStatement
    |  ForStatement
    |  SwitchStatement
    |  BreakStatement
    |  ContinueStatement
    |  ReturnStatement
    |  ExpressionStatement
    |  BlockStatement       (* never standalone — only inside `if`/`for`/`switch` bodies *)

VariableDeclaration
    := ("var" | "varip")? TypeAnnotation? Identifier "=" Expression NEWLINE
       (* TypeAnnotation must precede Identifier when both are present *)
Assignment
    := Identifier (":=" | "=") Expression NEWLINE
       (* parser doesn't distinguish declaration from reassignment by syntax —
          Task 5's semantic analyzer does, using scope information *)
IfStatement
    := "if" Expression NEWLINE INDENT Statement+ DEDENT
       ("else" ("if" Expression NEWLINE INDENT Statement+ DEDENT
                | NEWLINE INDENT Statement+ DEDENT))?
ForStatement
    := "for" Identifier "=" Expression "to" Expression ("by" Expression)? NEWLINE
       INDENT Statement+ DEDENT
       (* `for ... in` form is rejected here with `unsupported-for-in` —
          Task 4 detects the `in` keyword in expression position to confirm *)
SwitchStatement
    := "switch" Expression? NEWLINE INDENT SwitchCase+ DEDENT
SwitchCase
    := (Expression "=>" | "=>") Statement+
```

For Task 3, all `Expression` slots call the stub `parseExpression()`
that captures tokens until it sees `NEWLINE` / `,` / `)` / `]` /
matching boundary. Task 4 replaces with the real expression parser.

### 5. Error recovery

The parser must continue past most errors. After emitting a
`ParserDiagnostic`, recover by consuming tokens until the next
`NEWLINE` at the current indent level. Never throw out of
`parseStatements`. Diagnostics list grows; the AST always returns.

### 6. Diagnostic codes (this task)

- `unsupported-pine-version` — version != 6.
- `missing-version-directive` — script doesn't start with `//@version=N`.
- `unsupported-strategy` — `strategy(...)` declaration.
- `unsupported-library` — `library(...)` declaration.
- `unsupported-for-in` — `for x in ...` form.
- `unsupported-while` — `while` keyword.
- `expected-token` — generic recovery diagnostic.
- `unexpected-token` — generic recovery diagnostic.

Codes are added to `src/diagnostics/codes.ts` (created here as a
single-source registry). Each entry: `code`, `severity` (default
"error"), `defaultMessage`, `defaultSuggestion`.

### 7. Public surface (still package-internal)

```ts
// src/parser/index.ts
export { parseStatements } from "./parse.js";
export type { ParseResult, ParserDiagnostic } from "./parse.js";

// src/ast/index.ts
export * from "./script.js";
export * from "./statements.js";
export * from "./expressions.js";
export * from "./types.js";
export * from "./spans.js";
```

The parser is package-internal. Not re-exported from
`@invinite-org/chartlang-pine-converter`.

### 8. Tests (§16.3)

| File | Purpose |
|------|---------|
| `parse.test.ts` | One golden test per statement kind: minimal valid form + one error-recovery case. |
| `parse.property.test.ts` | Property: lex → parse → walk AST → every node's span lies within its parent's span. Property: `parseStatements(emptyTokens)` returns no diagnostics besides `missing-version-directive`. |
| `cursor.test.ts` | Standalone tests for `TokenCursor.expect`/`match`/`recover`. |
| `ast-spans.test.ts` | Walk fixture trees, assert every node has a contiguous span. |

Coverage 100% on `src/parser/`, `src/ast/`, `src/diagnostics/codes.ts`.

### 9. JSDoc

Every exported symbol in `src/parser/index.ts` and `src/ast/*` carries
`@since 0.1`, `@experimental`, and an `@example` block.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/ast/script.ts` | Create | Script + declaration node types. |
| `packages/pine-converter/src/ast/statements.ts` | Create | Statement union + members. |
| `packages/pine-converter/src/ast/expressions.ts` | Create | Expression stubs. |
| `packages/pine-converter/src/ast/types.ts` | Create | Type-annotation node types. |
| `packages/pine-converter/src/ast/spans.ts` | Create | Span mixin. |
| `packages/pine-converter/src/ast/index.ts` | Replace placeholder | Barrel re-export. |
| `packages/pine-converter/src/parser/cursor.ts` | Create | TokenCursor helper. |
| `packages/pine-converter/src/parser/parse.ts` | Create | Top-level parser entry. |
| `packages/pine-converter/src/parser/declarations.ts` | Create | Indicator/strategy/library parsing. |
| `packages/pine-converter/src/parser/statements.ts` | Create | Statement parsing. |
| `packages/pine-converter/src/parser/index.ts` | Replace placeholder | Barrel re-export. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Create | Diagnostic code registry. |
| `packages/pine-converter/src/diagnostics/index.ts` | Replace placeholder | Barrel re-export. |
| `packages/pine-converter/src/parser/parse.test.ts` | Create | Per-statement golden tests. |
| `packages/pine-converter/src/parser/parse.property.test.ts` | Create | Span containment + empty input. |
| `packages/pine-converter/src/parser/cursor.test.ts` | Create | TokenCursor unit tests. |
| `packages/pine-converter/src/parser/ast-spans.test.ts` | Create | Span walk verification. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm docs:check`

## Changeset

`.changeset/pine-converter-parser-statements.md` — patch bump.

## Acceptance Criteria

- A fixture `indicator-only.pine` (`//@version=6\nindicator("hi")\n`)
  parses to a `Script` with one `IndicatorDeclaration` and zero
  diagnostics.
- A `strategy("x")` fixture parses successfully but with exactly one
  `unsupported-strategy` diagnostic.
- A `for i in arr\n    x := i\n` fixture emits `unsupported-for-in`
  but continues parsing the next statement.
- Property test: every AST node's span ⊆ its parent's span.
- 100% coverage on `src/parser/`, `src/ast/`, `src/diagnostics/`.
- JSDoc + lint + typecheck gates green.
- Changeset committed.
