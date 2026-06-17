# Task 3 — Pine v6 parser: AST + declarations + statements — Validated Plan

## Context

Build the Pine v6 AST node vocabulary (`src/ast/`) and a hand-rolled
recursive-descent parser (`src/parser/`) for top-level declarations and
statements, consuming the Task 2 lexer's `readonly Token[]` stream.
Expressions are stubbed (`UnknownExpression`) and filled by Task 4. A
single-source diagnostic-code registry lands in
`src/diagnostics/codes.ts`. Everything here is package-internal — NOT
re-exported from `src/index.ts`.

## Pre-existing work (verified against workspace)

- `src/lexer/` is DONE. `lex(source): LexResult` →
  `{ tokens: readonly Token[]; diagnostics }`. `Token` =
  `{ kind: TokenKind; text; span: SourceSpan; versionNumber?; stringValue?;
  numericValue?; malformed? }`. `TokenKind` =
  `keyword | identifier | int | float | string | color | operator |
  punctuation | newline | indent | dedent | comment | version-directive |
  eof`.
- **The version directive is ONE token** (`kind: "version-directive"`,
  `versionNumber` populated), NOT `//@version=` + `int`. The task grammar
  `VersionDirective := "//@version=" Int` is written against raw text;
  the parser consumes the lexer's single token. This honors the lexer
  model (CLAUDE.md mandate).
- Synthetic block tokens: `newline` (statement terminator), `indent`
  (open block), `dedent` (close block). INDENT count == DEDENT count
  before the single trailing `eof` (lexer invariant). `comment` tokens
  CAN appear in the stream (blank/comment-only lines still emit
  `newline`) — the cursor skips `comment` tokens.
- `src/index.ts` exports `SourceSpan` (1-based) + `Diagnostic`
  `{ code; severity; message; span; suggestion? }`. AST/parser reuse
  these exact shapes.
- `src/parser/index.ts`, `src/ast/index.ts`, `src/diagnostics/index.ts`
  are placeholders (`export {};`). `package.json#exports` forward-reserves
  `./diagnostics`.
- `vitest.config.ts` enforces 100% coverage, excludes `**/index.ts`,
  `**/types.ts`, and `src/lexer/tokens.ts`. My `src/ast/*.ts` files are
  all declaration-only AST node types → they must be excluded from
  coverage (rename none to `index`/`types`, so I place ALL AST node
  declarations into files named to match the `types.ts` exclusion is not
  automatic). **Resolution:** the AST modules carry only `type`
  declarations (zero runtime), but coverage's exclude globs only match
  `index.ts`/`types.ts`. To avoid an unhittable-line gate failure, AST
  declaration files emit no runtime statements at all — pure `export type`
  — which v8 coverage does not count (no executable lines). Verified: the
  lexer's `tokens.ts` is declaration-only AND excluded; but a pure-type
  module reports zero statements so 100% is vacuously met even without an
  exclude. I will keep AST files pure-type to stay safe.

## Issues found / resolved

1. **Version directive token vs grammar text.** Resolved above — consume
   the single `version-directive` token; read `versionNumber`.
2. **`comment` tokens in the stream.** The cursor must skip `comment`
   tokens transparently so statement parsing never trips on them.
3. **AST coverage.** AST node files are pure `export type` (no runtime) →
   no executable lines → 100% coverage vacuously. The discriminant is a
   string-literal type, not a runtime const.
4. **`switch`/`case` token model.** Pine uses the `case` keyword? No —
   v6 `switch` cases are `expr =>` / `=>` arms, not `case`. The lexer has
   `case`/`default` in `PINE_V6_KEYWORDS` but Pine v6 switch arms use
   `=>`. The grammar in the task (`SwitchCase := (Expression "=>" | "=>")
   Statement+`) confirms `=>`-delimited arms. I follow the task grammar.
5. **`for ... in` rejection.** Detected in Task 3 by peeking for the `in`
   keyword after `for Identifier` instead of `=`. Emits `unsupported-for-in`
   and recovers. (Task 4 refines via expression position; Task 3's
   keyword peek is sufficient and self-contained.)
6. **`while` rejection.** `while` is a keyword; a statement starting with
   it emits `unsupported-while` and recovers.
7. **No `let` keyword in Pine.** The task title mentions "`let`-style" but
   Pine has only `var`/`varip` + bare declaration. `VariableDeclaration`
   grammar omits `let`. Honored.
8. **Stub `parseExpression`.** Consumes tokens until a boundary
   (`newline` / `,` / `)` / `]` / `=>` / `to` / `by` / `eof` / `indent` /
   `dedent`), packaging them into `UnknownExpression`. Lives in
   `src/parser/expression-stub.ts` so Task 4 swaps one module.

## Improvements

- `TokenCursor` is a standalone, independently-tested helper
  (`cursor.ts`) — the parser is a thin consumer.
- Diagnostic codes are a single typed registry
  (`DIAGNOSTIC_CODES`) so message/severity/suggestion live in one place;
  the parser references codes by key, never inlines strings.
- A shared `spanBetween(a, b)` helper composes parent spans from child
  spans, guaranteeing the span-containment property the property test
  asserts.

## Numbered steps (verified paths)

1. `src/ast/spans.ts` — `WithSpan` mixin + `spanBetween` helper TYPE
   (`spanBetween` is runtime → lives here, covered). Re-think: keep
   `spanBetween` as runtime in `src/parser/spans.ts` to keep `ast/` pure.
   **Decision:** `src/ast/spans.ts` = pure `WithSpan` type only;
   `spanBetween` runtime helper lives in `src/parser/spans.ts` (covered).
2. `src/ast/types.ts` — `TypeAnnotation` union (named Pine types +
   generic `array/matrix/map/series/simple/const/input`).
3. `src/ast/expressions.ts` — `ExpressionNode` =
   `IdentifierExpression | LiteralExpression | UnknownExpression`.
4. `src/ast/statements.ts` — `Statement` union + members.
5. `src/ast/script.ts` — `Script`, `Declaration` union,
   `IndicatorDeclaration`, `StrategyDeclaration`, `LibraryDeclaration`,
   `ImportDeclaration`, plus `Argument`/`ArgumentList`.
6. `src/ast/index.ts` — barrel re-export of the five modules.
7. `src/diagnostics/codes.ts` — `DIAGNOSTIC_CODES` registry +
   `ParserDiagnosticCode` union + `makeDiagnostic` helper (covered).
8. `src/diagnostics/index.ts` — barrel re-export.
9. `src/parser/spans.ts` — `spanBetween(a, b)` runtime helper (covered).
10. `src/parser/cursor.ts` — `TokenCursor`: `peek`, `peekKind`, `next`,
    `expect`, `match`, `recover`, comment-skipping, `atEnd`.
11. `src/parser/expression-stub.ts` — `parseExpression(cursor)` stub →
    `UnknownExpression`.
12. `src/parser/declarations.ts` — version directive + indicator/strategy/
    library decl parsing.
13. `src/parser/statements.ts` — every statement-kind parser + block
    parsing (INDENT Statement+ DEDENT).
14. `src/parser/parse.ts` — `parseStatements(tokens)` entry + `ParseResult`
    + `ParserDiagnostic` types.
15. `src/parser/index.ts` — barrel re-export of `parseStatements` +
    types.
16. Tests: `parse.test.ts`, `parse.property.test.ts`, `cursor.test.ts`,
    `ast-spans.test.ts`, plus `spans.test.ts` + `codes.test.ts` +
    `expression-stub.test.ts` for 100% coverage of every runtime module.
17. Changeset `.changeset/pine-converter-parser-statements.md` — patch.
18. Append "Parser / AST" section to `packages/pine-converter/CLAUDE.md`.

## Files to create / modify

| File | Action |
|------|--------|
| `src/ast/spans.ts` | create (pure type) |
| `src/ast/types.ts` | create (pure type) |
| `src/ast/expressions.ts` | create (pure type) |
| `src/ast/statements.ts` | create (pure type) |
| `src/ast/script.ts` | create (pure type) |
| `src/ast/index.ts` | replace placeholder |
| `src/diagnostics/codes.ts` | create |
| `src/diagnostics/index.ts` | replace placeholder |
| `src/parser/spans.ts` | create |
| `src/parser/cursor.ts` | create |
| `src/parser/expression-stub.ts` | create |
| `src/parser/declarations.ts` | create |
| `src/parser/statements.ts` | create |
| `src/parser/parse.ts` | create |
| `src/parser/index.ts` | replace placeholder |
| `src/parser/parse.test.ts` | create |
| `src/parser/parse.property.test.ts` | create |
| `src/parser/cursor.test.ts` | create |
| `src/parser/ast-spans.test.ts` | create |
| `src/parser/spans.test.ts` | create |
| `src/parser/expression-stub.test.ts` | create |
| `src/diagnostics/codes.test.ts` | create |
| `.changeset/pine-converter-parser-statements.md` | create |
| `packages/pine-converter/CLAUDE.md` | append Parser/AST section |

Do NOT touch `src/lexer/`, `src/mapping/`, `src/index.ts`.

## Gates to keep green

- `pnpm --filter @invinite-org/chartlang-pine-converter typecheck`
- `pnpm --filter @invinite-org/chartlang-pine-converter test` (100% cov)
- `pnpm lint`
- `pnpm docs:check` (every `@example` typechecks; none qualify for
  compiler execution — no `defineIndicator`)

## Changeset

`.changeset/pine-converter-parser-statements.md` — `patch` on
`@invinite-org/chartlang-pine-converter` (pre-1.0 internal addition).

## Acceptance criteria

- [ ] `//@version=6\nindicator("hi")\n` → `Script` with one
      `IndicatorDeclaration`, zero diagnostics.
- [ ] `strategy("x")` → parses, exactly one `unsupported-strategy`.
- [ ] `for i in arr\n    x := i\n` → `unsupported-for-in`, continues.
- [ ] Property: every node's span ⊆ its parent's span.
- [ ] 100% coverage on `src/parser/`, `src/ast/`, `src/diagnostics/`.
- [ ] JSDoc + lint + typecheck + docs:check green.
- [ ] Changeset committed.
