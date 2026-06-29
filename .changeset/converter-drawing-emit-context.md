---
"@invinite-org/chartlang-pine-converter": patch
---

Fix three Pine→chartlang lowering gaps that made the support/resistance sample
emit chartlang that did not compile (the converter reported 0 errors). The
drawing transforms (Camp A/B, tables, setter-fold) now emit option/setter/cell
values through the shared input/ring/`str`-aware `emitWithContext` instead of a
bare `emitExpr` / minimal context:

- A bare `color=<input.color>` draw option now qualifies to `(inputs.<name> as
  string)` (and `input.color` casts as `string`) instead of leaking the
  undefined Pine identifier.
- `str.tostring(...)` lowers to `String(...)` in every expression context (a
  `label.set_text` body, a binary-op operand), not just `table.cell`.
- `array.size(<ring>)` over a Camp B drawing-handle ring lowers to
  `<ring>.size()` even when nested (e.g. inside `str.tostring`), via the new
  `EmitContext.handleRings` rewrite.
