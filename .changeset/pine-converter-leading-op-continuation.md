---
"@invinite-org/chartlang-pine-converter": minor
---

pine-converter (lexer): support **leading-operator line continuation**. An
indented line that begins with an infix/ternary lead (`and`, `or`, `+`, `-`,
`*`, `/`, `%`, `==`, `!=`, `>`, `>=`, `<`, `<=`, `?`, `:`) now continues the
previous line's expression instead of starting a new (truncated) statement —
the MASM-style multi-line boolean condition that dominates real-world Pine.

The lexer suppresses the intervening `newline`/`indent`/`dedent` via a
**deferred `newline` emit** (bounded one-token buffering: the held newline is
resolved by the very next significant token, not by arbitrary lookahead),
composing with the existing paren-depth + trailing-comma suppression. A
continuation line must be indented **strictly deeper than the statement-start
column**, so a non-indented unary `-`/`+` (or a same-indent `and`) stays a
separate statement. Block structure is unaffected: `if`/`for` bodies still open
on a real `indent` and close on the matching `dedent`, and the indent/dedent
counts stay balanced. The prefix-only `not` is never a continuation lead.

No new diagnostic codes; the stable `code:` contract is unchanged. A
`37-leading-op-continuation` fixture triple locks the behaviour behind the
compile round-trip, and `docs/converter/supported.md` documents the idiom.
