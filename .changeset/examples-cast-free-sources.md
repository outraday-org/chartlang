---
"@invinite-org/chartlang-examples": minor
---

Drop the 20 redundant `inputs.<key> as T` casts from the 19 example scripts that
still carried them, and regenerate the catalogue.

Since compiler 1.10.0 / core 1.9.0 the `compute` `inputs` bag is typed per input
descriptor (`ResolveComputeInputs` → `ResolvedInputs` → `ResolveInputValue`), so
`inputs.length` is already `number`, `inputs.showMa` already `boolean`,
`inputs.col` already `string`, and `input.enum` narrows to its literal option
union. The casts were teaching a pattern the language no longer needs — and one
that actively hides the `input.externalSeries` → `Series<T>` case the type
surface was built for.

`EXAMPLE_CATALOGUE`'s inlined `source` strings are regenerated accordingly, so
downstream template catalogues pick the cast-free sources up on upgrade. The
example set, ids, categories, and metadata are unchanged.
