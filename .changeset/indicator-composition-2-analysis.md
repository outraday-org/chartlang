---
"@invinite-org/chartlang-compiler": minor
---

Add `extractDependencyGraph` analysis pass and `rewriteDependencyAccessors`
transformer for indicator composition. Six new `dep-*` compile diagnostics
plus three structural diagnostics (`multiple-default-exports`,
`non-const-define-binding`, `duplicate-output-title`). Multi-binding
`defineIndicator` per file now accepted; single-file behaviour unchanged.
Existing `.chart.ts` files compile through with byte-identical output.
