---
"@invinite-org/chartlang-pine-converter": minor
---

pine-converter (transform): lower a nested `ta.*` call to its `(...).current`
scalar projection **wherever it sits in a scalar position** — an operand of a
binary/unary operator, a ternary arm, or a `math.*` / `Math.*` argument — not
only when it is the top-level value of a declaration. `ta.rsi(close, 14) * 0.1`
now converts to `ta.rsi(bar.close, 14).current * 0.1` instead of a bare
`Series<number>` that does not type-check. The lowering routes through the same
`taLookup`-backed rule the top-level `emitTa` uses (so `ta.rma` → `ta.smma` and
pivots resolve), and is position-aware: a `ta.*` fed as a **source argument to
another `ta.*`** stays a `Series` (chartlang `ta.*` sources are
`Series<number>`), as do a direct `plot`/`hline` value, a `request.security`
callback body, and a history-access receiver. No double `.current` at top
level; existing golden output is byte-identical.

The lowering is now observable: a nested projection raises a `nested-ta-lowered`
info (deduped once per script) and an unmapped / rejected `ta.*` left as a
`Series` in a scalar position raises a `nested-ta-not-lowered` warning, so a
nested `ta.*` is never a silent non-compiling output. Fixture
`41-nested-ta-arith` exercises the operator, ternary, and `ta`-source forms and
round-trips through the compiler.
