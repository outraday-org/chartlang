---
"@invinite-org/chartlang-pine-converter": minor
---

Resolve a bare `na` in a color-valued expression to the transparent color
(`#00000000`) even without a `color` type annotation — e.g. an untyped
`c = cond ? color.green : na`. Previously the `na` arm defaulted to
`Number.NaN`, poisoning the value's type to `string | number`.
