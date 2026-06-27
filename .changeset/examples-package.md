---
"@invinite-org/chartlang-examples": minor
---

New published package `@invinite-org/chartlang-examples`: the chartlang
example catalogue as a typed data surface. Exports `EXAMPLE_CATALOGUE`
(`ReadonlyArray<ExampleMetaWithSource>` — every example's metadata plus its
inlined `.chart.ts` source, the same payload as `examples/catalogue.json`),
the `ExampleCategory` / `CATEGORY_LABELS` / `CATEGORY_ORDER` taxonomy, and the
`ExampleMeta` / `ExampleMetaWithSource` types. The data module
(`src/catalogue.generated.ts`) is generated from `examples/catalogue.ts` by
`pnpm examples:generate` and byte-diff-gated by `pnpm examples:gate`, so it can
never drift from the source catalogue. Downstream repos (invinite) consume this
to regenerate their chartlang template dialog from the canonical catalogue.
