# @invinite-org/chartlang-examples

`experimental`

The chartlang example catalogue as a typed data package: every worked
example's metadata plus its inlined `.chart.ts` source, ready to drive a
downstream template/example picker (e.g. the invinite chartlang editor).

## Install

```bash
pnpm add @invinite-org/chartlang-examples
```

## Public surface

- `EXAMPLE_CATALOGUE: ReadonlyArray<ExampleMetaWithSource>` — one entry per
  example: `{ id, label, description, category, primitives, idioms?, source }`.
  `source` is the full `.chart.ts` text (identical payload to the repo's
  `examples/catalogue.json`).
- `ExampleCategory`, `CATEGORY_LABELS`, `CATEGORY_ORDER` — the shared
  taxonomy (the same categories the chartlang demo dialog uses).
- Types `ExampleMeta`, `ExampleMetaWithSource`.

The data module is generated from `examples/catalogue.ts` by
`pnpm examples:generate` and byte-diff-gated, so it never drifts.

## Minimum-viable API call

```ts
import { CATEGORY_LABELS, EXAMPLE_CATALOGUE } from "@invinite-org/chartlang-examples";

for (const example of EXAMPLE_CATALOGUE) {
    console.log(CATEGORY_LABELS[example.category], example.label);
    console.log(example.source); // the runnable .chart.ts source
}
```

## Docs

See [`docs/examples/`](../../docs/examples/) and
[`CONTRIBUTING.md`](../../CONTRIBUTING.md).

## License

MIT
