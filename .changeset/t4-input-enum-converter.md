---
"@invinite-org/chartlang-pine-converter": minor
---

Parse value-position `[…]` array literals (T4 Task 2).

- **A `[…]` appearing as a value now parses to an `ArrayLiteralExpression`**
  instead of breaking with `expected-token` / `unexpected-token`. This covers a
  named-arg value (`input.string("EMA", options=["SMA", "EMA"])`), a call
  argument (`f([high, low])`), and a right-hand side (`x = [1, 2, 3]`); empty
  `[]` and a trailing comma are allowed. The Pratt parser disambiguates the
  three `[` contexts automatically: a **prefix** `[` (value start) is the array
  literal, a **postfix** `[` (`a[0]`) stays history-access, and a
  statement-leading `[ ident, … ] =` stays tuple destructuring (a malformed
  statement-leading head still rejects with `unexpected-token`).
- An unterminated `[` recovers via the established zero-width fallback — the
  parser never throws.

This is the parser enabler for the T4 `input.string/int(options=)` →
`input.enum` mapping (Tasks 3–4 consume the node) and for T5's `[high, low]`
`request.security` source list.

Map string dropdowns to `input.enum` (T4 Task 3).

- **`input.string(default, title?, options=["A", "B"])` now converts to
  `input.enum(default, ["A", "B"], { title? })`** — a real fixed-options
  dropdown instead of a free-text input that silently dropped the options.
  String comparisons against the value (`sel == "EMA"`) keep working. The title
  threads from the positional 2nd arg or a `title=` named arg.
- A `default` not in `options` warns `input-string-options-default-mismatch`
  (the enum is still emitted); a mixed / non-literal `options=` list falls back
  to a plain `input.string` with `input-string-options-not-literal`. Numeric
  `options=` dropdowns and Pine's UDT-backed `input.enum` are unchanged here
  (numeric is Task 4; the UDT enum stays rejected).
- New diagnostic codes: `input-string-options-default-mismatch`,
  `input-string-options-not-literal`.

Map numeric dropdowns and bare `input()` (T4 Task 4).

- **`input.int/float(default, options=[8, 21, 30, …])` now converts to a numeric
  `input.enum(default, [8, 21, 30, …], { title? })`** (the `input.enum<number>`
  form Task 1 widened core for). Numeric use sites keep working — `len == 8`
  comparisons and length args (`ta.sma(close, len)`) read `inputs.len as number`.
- **A bare generic `input(...)` now hoists to `manifest.inputs`** instead of
  leaking an uncompilable `input(...)` call: a series default
  (`input(title="LT", defval=close)`) → `input.source("close", { title? })`; a
  literal default → the typed `input.int/float/bool/string/color` by the
  literal's kind. A missing / `na` / computed default rejects with
  `non-literal-input-default`. The source-vs-typed choice is a transform
  decision; `INPUT_MAP` carries only a recognised-primitive marker for bare
  `input`.
