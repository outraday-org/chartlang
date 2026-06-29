---
"@invinite-org/chartlang-pine-converter": minor
---

Support value-form `switch` expressions (`x = switch s …`, Pine's `cf_ma`
helper). A `switch` in a declaration / assignment / tuple value position now
parses into a new `SwitchExpression` AST node (a Pratt prefix rule) and lowers
to a right-nested ternary chain: with a subject, `subject === label ? value :
…`; subject-less, `cond ? value : …`; a wildcard `=> value` arm is the default;
and an unmatched subject yields `na` (`Number.NaN`), matching Pine's value-
`switch` semantics. Each arm value is lowered in scalar position, so a nested
`ta.*` arm projects to its `.current` scalar. The old hard reject
(`switch-expression-unsupported`) is retired for the single-expression value
form — which also clears the `unexpected-token` recovery cascades it caused — and
now fires only for the residual unsupported sub-shape (a multi-statement block,
comma list, or `:=` assignment arm).
