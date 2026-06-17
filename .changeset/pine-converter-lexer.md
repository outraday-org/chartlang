---
"@invinite-org/chartlang-pine-converter": patch
---

Add the package-internal Pine Script v6 lexer (`src/lexer/`). `lex(source)` tokenizes Pine v6 — keywords/identifiers, member access, int/float/scientific/hex numerics with `_` separators, single/double-quoted strings with escapes, `#RRGGBB[AA]` colors, operators/punctuation, line comments, and the `//@version=N` directive — and models Pine's significant indentation with synthetic `newline`/`indent`/`dedent` tokens (line-continuation aware via bracket depth and trailing commas). Malformed numerics, unterminated strings, invalid colors, illegal characters, and mixed/inconsistent indentation surface as structured `LexerDiagnostic`s rather than throwing. The lexer is package-internal (consumed by the Task 3 parser) and is not re-exported from the package root.
