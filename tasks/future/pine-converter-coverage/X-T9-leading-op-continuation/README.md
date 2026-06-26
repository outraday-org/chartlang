# T9 — Converter: leading-operator line continuation

## Overview

Support Pine's **leading-operator line continuation** — an expression split
across lines where the continuation line *begins* with a binary/boolean
operator (`and`, `or`, `+`, `?`, …). `MASM_Strat.md` uses this in nearly every
condition (long/short entry/exit, never-long, stay-long), e.g.:

```pine
long_entry_cond1 = ma_slope > consol_range_adj_merged_top and rsi_ma_slope > 0
   and not long_pos_active and not never_long_conditions and in_timeframe and long_entry_cond1_swtch
```

This is **not** a v5-ism (the v5→v6 guide reports no line-continuation change)
and **not** Trend-Wizard-specific — it breaks almost any real-world Pine
script. Highest-leverage gap in the batch.

## Current State (evidence — ran built converter)

Pine:
```pine
cond = close > open and rsi_ok
   and not sw
   and close > 0
```
→ `pine-converter/parse/unexpected-token` + `semantic/unknown-identifier`.
The continuation lines are lexed as **separate statements**, so the expression
is truncated and the tail becomes a dangling broken statement:

```ts
let cond = (bar.close > bar.open) && rsi_ok;   // truncated at line 1
(undefined) && (!(inputs.sw as boolean));       // orphaned continuation
```

Root cause (`src/lexer/`):
- The lexer models significant indentation with synthetic
  `newline`/`indent`/`dedent` tokens (`indent.ts`, `lex.ts`).
- Line continuation is suppressed **only** while `parenDepth > 0` OR the last
  significant token is a `,` (documented in `packages/pine-converter/CLAUDE.md`
  §Lexer: *"Line continuation is a paren-depth + trailing-comma rule"*).
- A line ending in a complete-looking token (`open`, `false`) followed by a
  line starting with `and`/`or` is therefore **not** continued → a spurious
  `newline` ends the statement.

## Target State

- An expression continues across a `newline` when the continuation is
  unambiguous: the next significant token after the newline (and any
  `indent`) is a **binary/boolean operator** (`and`, `or`, `+`, `-`, `*`, `/`,
  `%`, `==`, `!=`, `>`, `>=`, `<`, `<=`, `?`, `:`) — none of which can begin a
  statement. Pine's actual rule keys on indentation; matching "indented +
  leading-operator" is the robust, low-risk subset that covers real scripts.
- MASM's multi-line conditions parse as single boolean expressions.
- No regression to block structure (`if`/`for` bodies still open/close on
  real `indent`/`dedent`).

## Architecture Decisions (to finalize in step 2)

| Decision | Notes |
|----------|-------|
| Suppress in the **lexer** vs. recover in the **parser** | Two viable approaches: (a) lexer suppresses the `newline`/`indent`/`dedent` when the next significant token is a continuation operator (mirrors the existing paren-depth/trailing-comma suppression in `indent.ts`); (b) the Pratt parser, on hitting a `newline` mid-expression, peeks past it and continues if the next token is an infix operator. Lexer-side keeps the parser simple and matches the existing suppression model — **prefer (a)**, implemented as a **deferred `newline` emit** (bounded one-token buffering — the pending `newline` is resolved by the next significant token, NOT arbitrary lookahead, so it stays consistent with the documented "not lookahead" rule). |
| Leading vs. trailing operator | Pine also allows the operator at the **end** of a line (`a and\n  b`). The trailing-operator case already nearly works (line ends mid-expression); the **leading-operator** case is the MASM pattern and the gap. Cover leading; verify trailing. |
| Indentation guard | Only treat as continuation when the continuation line is indented **strictly deeper than the statement-start column** (the indent column of the statement's first token), to avoid swallowing a genuinely new statement that happens to start with `-`/`+` (unary). A `-`/`+` line at the same indent as the statement start stays a separate statement. Disambiguate unary `-x`/`+x` from infix. |
| Balance invariant | The lexer's `indent`/`dedent` counts must stay balanced (property test in `lex.test.ts`). Suppressed continuation indents must not push the indent stack. |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| Indent / continuation tracker | `src/lexer/indent.ts` (`createIndentTracker`, paren-depth + trailing-comma suppression) | Add leading-operator suppression alongside. |
| Lexer driver | `src/lexer/lex.ts` | Wire the new suppression. |
| Pratt parser (fallback approach) | `src/parser/expressions.ts` (`parseBinary`, `BINARY_PRECEDENCE`) | If parser-side recovery is chosen instead. |
| Lex property test | `src/lexer/lex.test.ts` | Extend the indent/dedent-balance property. |

## Dependencies

- None. Foundational — unblocks MASM (and most real scripts). Sequence early.

## Dependency Graph

```
Task 1 (lexer: leading-operator continuation + indentation/unary guard)
  |
  v
Task 2 (fixtures + compile round-trip + docs/CLAUDE §Lexer)
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Lexer: leading-operator line continuation](./1-lexer-leading-operator-continuation.md) | pine-converter | None | High |
| 2 | [Fixtures, compile round-trip, docs/CLAUDE](./2-fixtures-docs.md) | pine-converter, docs | 1 | Low |

## Acceptance Criteria

- MASM's multi-line `long_entry_cond*` / `short_exit_cond*` boolean
  expressions convert as single expressions with no `unexpected-token`.
- A real new statement beginning with unary `-`/`+` is **not** mis-merged into
  the previous line.

## Deferred / Follow-Up

- Full Pine indentation-based continuation (non-operator-led continuations),
  if any script needs a continuation that doesn't start with an operator.
