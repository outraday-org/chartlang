# Task 1 — Lexer: leading-operator line continuation

> **Status: TODO**

## Goal

Teach the lexer to treat an indented continuation line that **begins with a
binary/boolean operator** (`and`, `or`, `+`, `-`, `*`, `/`, `%`, `==`, `!=`,
`>`, `>=`, `<`, `<=`, `?`, `:`) as a continuation of the previous line's
expression, suppressing the synthetic `newline`/`indent`/`dedent` the way the
existing paren-depth + trailing-comma rule already does. This unblocks the
multi-line boolean conditions that dominate `MASM_Strat.md` (and most
real-world Pine).

## Prerequisites

None. Foundational — sequence early.

## Current Behavior

Pine:
```pine
cond = close > open and rsi_ok
   and not sw
   and close > 0
```
lexes the continuation lines as **separate statements**, so the parser
truncates the expression and orphans the tail:

```ts
let cond = (bar.close > bar.open) && rsi_ok;   // truncated at line 1
(undefined) && (!(inputs.sw as boolean));       // orphaned continuation → unexpected-token
```

→ `pine-converter/parse/unexpected-token` + `semantic/unknown-identifier`.

- The lexer models significant indentation with synthetic
  `newline`/`indent`/`dedent` tokens (`src/lexer/lex.ts`, `src/lexer/indent.ts`).
- `createIndentTracker` (`src/lexer/indent.ts`) suppresses continuation **only**
  while `parenDepth > 0` OR the last significant token is a `,`
  (`packages/pine-converter/CLAUDE.md` §Lexer: *"Line continuation is a
  paren-depth + trailing-comma rule, not lookahead."*).
- A line ending in a complete token (`open`, `false`) followed by a line
  starting with `and`/`or` is therefore **not** continued.

## Desired Behavior

```pine
# all of these lex as ONE statement / expression:
cond = a and b
   and c
   or d

x = ma_slope > top
   and rsi_ma_slope > 0
   and not long_pos_active

# NOT a continuation — a new statement led by unary minus stays separate:
y = 1
-z                       # (degenerate, but must not merge into `y = 1`)
```

The leading-operator continuation collapses the intervening
`newline`/`indent`/`dedent` so the parser sees one uninterrupted token stream
for the expression, identical to wrapping the whole RHS in parentheses.

## Requirements

### 1. Leading-operator continuation in the indent tracker (`src/lexer/indent.ts`)

- Extend the suppression model so a `newline` (and any consequent
  `indent`/`dedent`) is suppressed when the **next significant token** on the
  following line is a continuation operator. The existing rule is documented as
  *not* lookahead; the leading-operator rule unavoidably needs to inspect the
  next line's first significant token, so implement it as a **deferred emit**:
  when a `newline` is about to be emitted, hold it until the next significant
  token is known; if that token is an infix-lead operator (and the indentation
  guard in §2 passes), drop the held `newline`/`indent`/`dedent`; otherwise
  flush them as today. This is **bounded one-token buffering** (the pending
  `newline` is resolved by the very next significant token), NOT arbitrary
  multi-token lookahead — state that framing explicitly so the CLAUDE.md update
  (Task 2 §3) reads consistently with the existing "not lookahead" wording.
- Define the continuation-operator set as a **single shared constant** (do not
  inline the operator list at the call site). Key it on `(kind, text)` mirroring
  `binaryPrecedenceOf` in `src/parser/expressions.ts` — `and`/`or`/`not` are
  `keyword` tokens, the rest are punctuation. Seed it from the same operator
  surface as `BINARY_PRECEDENCE` (minus `not`) and note that the two MUST stay
  in sync: a future binary operator added to `BINARY_PRECEDENCE` must also be a
  continuation lead. `not` is **prefix-only** and must NOT trigger continuation
  on its own; only true infix leads (`and`, `or`, arithmetic, comparison, `?`,
  `:`) do.

### 2. Unary vs. infix disambiguation

- A line beginning with `-`/`+` is ambiguous (infix continuation vs. a new
  statement led by a unary sign). Only treat `-`/`+` as a continuation lead
  when the continuation line is indented **strictly deeper than the
  statement-start column** (Pine's real rule is indentation-based). The
  **statement-start column** is the indent column of the first token of the
  statement being continued (the column at which `cond`/`x`/… begins). A
  `-`/`+` line at the *same* indent as the statement start is a NEW statement (a
  unary expression), NOT a continuation, and must not merge into the previous
  line. `and`/`or`/comparison/`?`/`:` leads are unambiguous (cannot begin a
  statement) and may continue regardless, but keep the same strictly-deeper
  indentation guard for consistency.

### 3. Preserve the indent/dedent balance invariant

- When a held `newline` is suppressed (the next token is a continuation lead),
  do **not** run the indentation resolver for that continuation line — the
  column-level stack in `createIndentTracker` must be left untouched, so no
  `indent`/`dedent` is produced for it. Only real (non-suppressed) `newline`s
  drive `indent`/`dedent`. This keeps the "number of `indent` == number of
  `dedent` before `eof`" property (`src/lexer/lex.test.ts`) intact. A
  continuation line is transparent to block structure: an `if`/`for` body still
  opens on a real `indent` and closes on the matching `dedent`.
- Add a property-test assertion that the `indent`-count == `dedent`-count
  invariant still holds for inputs that contain leading-operator continuation
  lines (generate scripts with multi-line `and`/`or` conditions and assert the
  balance), not just for the pre-T9 corpus.

### 4. Keep blank/comment-only lines and paren/comma rules intact

- Blank and comment-only lines still emit a `newline` but never touch the
  indent stack (unchanged). The new rule composes with the existing
  paren-depth + trailing-comma suppression — inside parens the held-`newline`
  path is already suppressed, so do not double-handle.

### 5. Ternary `?`/`:` are lexer-valid but parser-completed

- `?` and `:` are valid continuation leads at the **lexer** level (a held
  `newline` before them is suppressed like any other infix lead). Their
  syntactic validity is the **parser**'s concern: `parseTernary`
  (`src/parser/expressions.ts`) completes the ternary. A bare `?`/`:` with no
  open ternary context is a **parse** error (`unexpected-token`), NOT a lex
  error — the lexer must not try to validate ternary structure. Keep this
  lexer/parser split explicit so the lexer stays surface-faithful.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/lexer/indent.ts` | Modify | Deferred-`newline` emit + leading-operator continuation + indentation/unary guard. |
| `packages/pine-converter/src/lexer/lex.ts` | Modify | Wire the deferred-emit handshake (hold `newline` until next significant token). |
| `packages/pine-converter/src/lexer/lex.test.ts` | Modify | Unit + property: leading `and`/`or`/comparison continuation, indented `-`/`+` continuation, non-indented `-x` stays separate, blank/comment lines, indent/dedent balance preserved. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (coverage **100%**)
- `pnpm docs:check`

## Changeset

Covered by the T9 feature changeset created in Task 2
(`@invinite-org/chartlang-pine-converter`, minor).

## Acceptance Criteria

- A multi-line expression whose continuation lines begin with `and`/`or`/a
  comparison/`?`/`:` lexes as a single statement (token stream identical to the
  paren-wrapped single-line form).
- The indent/dedent balance property still holds; `if`/`for` block boundaries
  are unaffected.
- A non-indented statement led by unary `-`/`+` is **not** merged into the
  previous line.
- Converter tests green at 100%.
