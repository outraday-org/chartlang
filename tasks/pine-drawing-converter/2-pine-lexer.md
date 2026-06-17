# Task 2 — Pine v6 lexer (with indentation tracking)

> **Status: TODO**

## Goal

Implement a deterministic, hand-rolled tokenizer for Pine Script v6
that consumes a source string and produces a token stream with stable
source spans and synthetic `INDENT` / `DEDENT` tokens reflecting Pine's
significant-indentation block scoping (similar to Python). The lexer is
the foundation Task 3's parser consumes — every later task ultimately
depends on its accuracy.

## Prerequisites

Task 1 (scaffolded package + public types).

## Current Behavior

`src/lexer/index.ts` is an empty placeholder. No tokenizer logic
exists.

## Desired Behavior

`@invinite-org/chartlang-pine-converter` ships a package-internal
`lex(source: string): LexResult` function in `src/lexer/lex.ts`
producing:

- A `readonly Token[]` array — every token carries `kind`, `text`,
  and a `SourceSpan`.
- A `readonly LexerDiagnostic[]` for malformed numerics, unterminated
  strings, illegal characters, etc. — using the diagnostic shape
  defined in `src/index.ts`.

The lexer correctly handles Pine v6's:
- Keywords, identifiers, member-access (`.`).
- Numeric literals (int, float, scientific, hex `0x…`).
- String literals (single + double quoted) with backslash escapes.
- Color literals `#RRGGBB[AA]`.
- Operators (`+ - * / % == != < <= > >= and or not ? : := => [ ] ( ) { } ,`).
- The history operator `[` `]` (lexed as plain brackets; the parser
  disambiguates).
- Line comments `// ...` including the `//@version=N` directive (lexed
  as a regular comment with a flag the parser reads).
- Block comments are **not** supported by Pine — illegal-character
  diagnostic.
- Continuation: a logical line that ends in an open bracket / paren or
  a comma continues onto the next physical line (no `INDENT` emission
  between).
- Significant indentation: emit `NEWLINE`, `INDENT`, `DEDENT` tokens
  for block structure. Spaces and tabs at column-start define a level;
  mixed tabs/spaces in the same file is a `mixed-indent` diagnostic
  (warning) and treats tabs as 4 spaces for level computation.

## Requirements

### 1. Token kinds (`src/lexer/tokens.ts`)

```ts
export type TokenKind =
    | "keyword"
    | "identifier"
    | "int"
    | "float"
    | "string"
    | "color"
    | "operator"
    | "punctuation"
    | "newline"
    | "indent"
    | "dedent"
    | "comment"
    | "version-directive"
    | "eof";

export type Token = Readonly<{
    kind: TokenKind;
    text: string;
    span: SourceSpan;
    /** For `version-directive` only: the integer version. */
    versionNumber?: number;
    /** For `string` only: the unescaped value. */
    stringValue?: string;
    /** For `int`/`float`: the parsed number. */
    numericValue?: number;
}>;
```

The Pine v6 keyword set lives in `src/lexer/keywords.ts` as a
`ReadonlySet<string>`:

```
and, or, not, if, else, for, to, by, in, while, switch, case,
default, var, varip, true, false, na, break, continue, return,
import, export, type, method, this
```

Reserved identifiers (`open`, `high`, `low`, `close`, `volume`,
`time`, `bar_index`, `barstate`, `barmerge`, `dayofweek`, `dayofmonth`,
`month`, `year`, `hour`, `minute`, `second`, `weekofyear`, `na`,
`syminfo`, `timeframe`, `session`, `chart`, `request`) are lexed as
plain identifiers — semantic resolution belongs in Task 5.

### 2. Indentation handling (`src/lexer/indent.ts`)

A small state machine tracks a stack of indent levels (column counts).
On NEWLINE, peek the next non-blank line's leading whitespace:

- Greater than top of stack → push, emit `INDENT`.
- Equal → no change.
- Less than top → pop levels until match, emit one `DEDENT` per pop.
  If no exact match found (unbalanced indent) → emit
  `inconsistent-dedent` warning and snap to the nearest lower level.

Lines that are blank or comment-only do not affect the stack — they
emit a `NEWLINE` only.

Line continuation rule: when scanning a NEWLINE, if the immediately
preceding non-comment token is `(`, `[`, `{`, or `,`, suppress the
NEWLINE (and any consequent INDENT/DEDENT) until the matching close.
Implementation: a paren-depth counter incremented/decremented as
brackets are emitted.

### 3. Numeric literal handling

- `123`, `1_000_000` (underscore separators allowed per v6) → `int`.
- `1.5`, `.5`, `1.`, `1e3`, `1.5e-2` → `float`.
- `0xDEAD` → `int`.
- Leading `+`/`-` is **not** part of the literal — the parser handles
  unary minus.
- Malformed: `1.2.3`, `1e`, `0x` → diagnostic `malformed-numeric`,
  span covers the bad characters, token still emitted as `int` with
  `numericValue: NaN` and a sentinel `malformed: true` flag on the
  token (so downstream passes can detect and short-circuit instead of
  propagating NaN through real arithmetic).

### 4. String literal handling

Two quote styles. Escapes recognized: `\n`, `\t`, `\\`, `\'`, `\"`,
`\xNN`, `\uNNNN`. Unterminated → diagnostic `unterminated-string`,
span runs to end of line, token emitted with `stringValue` = bytes
captured.

### 5. Color literal handling

Regex: `#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?` recognized when the `#`
appears at a token-start position. Followed by an alphanumeric →
diagnostic `invalid-color`.

### 6. Version directive

A comment starting with `//@version=N` (whitespace permitted) emits a
`version-directive` token instead of `comment`, with `versionNumber` =
parsed integer. Any other version → still emitted (parser rejects with
a clear `unsupported-pine-version` diagnostic later).

### 7. EOF handling

After the final NEWLINE, emit DEDENTs back to column 0, then an `eof`
token. Always exactly one `eof`, always at the very end.

### 8. Public surface inside the package

```ts
// src/lexer/index.ts
export { lex } from "./lex.js";
export type { LexResult, Token, TokenKind } from "./tokens.js";
```

`lex` is NOT re-exported from the package root (Task 1's `src/index.ts`).
The lexer is package-internal — only Task 3's parser consumes it.

### 9. Tests (§16.3 layer set)

Co-located with the implementation. Required layers:

| File | Purpose |
|------|---------|
| `lex.test.ts` | Hand-written fixtures: keyword set, every operator, all four numeric forms, both string forms with escapes, color literals, every diagnostic code, line continuation, INDENT/DEDENT balance, mixed-indent warning. |
| `lex.property.test.ts` | Property: lexing then concatenating `token.text` for tokens whose kind ∉ {`indent`, `dedent`, `newline`, `eof`} yields a substring of the original source (whitespace-stripped equivalence). Property: every `Token.span` references a contiguous byte range. |
| `indent.test.ts` | Standalone tests for the indent state machine: balanced blocks, deeply nested, dedent-to-zero on EOF, mixed-indent diagnostic. |

Coverage: 100% line/branch/function across `src/lexer/`. Exclude
`src/lexer/index.ts` (barrel).

### 10. JSDoc

Every exported symbol (`lex`, `LexResult`, `Token`, `TokenKind`)
carries `@since 0.1`, `@experimental`, and an `@example` block. The
`@example` for `lex` must compile (the `docs:check` gate will run it).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/lexer/index.ts` | Replace placeholder | Re-export `lex` + types. |
| `packages/pine-converter/src/lexer/lex.ts` | Create | Top-level lexer entry. |
| `packages/pine-converter/src/lexer/tokens.ts` | Create | `Token`, `TokenKind`, `LexResult` types. |
| `packages/pine-converter/src/lexer/keywords.ts` | Create | Pine v6 keyword set. |
| `packages/pine-converter/src/lexer/indent.ts` | Create | Indent state machine. |
| `packages/pine-converter/src/lexer/numeric.ts` | Create | Numeric literal scanner. |
| `packages/pine-converter/src/lexer/string.ts` | Create | String literal scanner. |
| `packages/pine-converter/src/lexer/lex.test.ts` | Create | Hand-written unit fixtures. |
| `packages/pine-converter/src/lexer/lex.property.test.ts` | Create | Reassembly + span property tests. |
| `packages/pine-converter/src/lexer/indent.test.ts` | Create | Indent state-machine tests. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage on `pine-converter`)
- `pnpm docs:check`
- `pnpm readme:check` (README unchanged)

## Changeset

`.changeset/pine-converter-lexer.md` — patch bump (still pre-1.0;
internal addition, no public surface change).

## Acceptance Criteria

- `lex("//@version=6\nindicator('hi')")` returns exactly:
  `version-directive`, `newline`, `identifier("indicator")`,
  `punctuation("(")`, `string("hi")`, `punctuation(")")`, `newline`,
  `eof`.
- INDENT/DEDENT balance holds: count of INDENT tokens equals count of
  DEDENT tokens emitted before EOF.
- Property test confirms token reassembly.
- 100% coverage on `src/lexer/`.
- Every `@example` compiles via `docs:check`.
- Changeset committed.
