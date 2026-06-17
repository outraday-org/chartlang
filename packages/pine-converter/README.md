# @invinite-org/chartlang-pine-converter

`experimental`

Pine Script v6 → chartlang source-to-source converter (drawings v1).
Takes a Pine v6 script string, emits an equivalent `.chart.ts` chartlang
script string plus structured diagnostics for any idiom that cannot be
faithfully translated. The v1 slice covers the Pine drawing surface
(`line.*`, `label.*`, `box.*`, `table.*`, `polyline.*`, `linefill.*`)
plus the minimum supporting infrastructure (indicator declaration,
inputs, `var`/`varip`, `barstate`, literal-bounded control flow).

This task ships the scaffold + public-type surface only — the conversion
pipeline (lexer → parser → semantic → mapping → transform → codegen) is
built out across Tasks 2–16 of the `pine-drawing-converter` tasklist.

## Install

```bash
pnpm add @invinite-org/chartlang-pine-converter
```

## Public surface

- `convert(source, opts?) → ConvertResult` — pure source-to-source
  conversion. Throws `ConverterNotReadyError` until later tasks land.
- Types: `ConvertOpts`, `ConvertResult`, `ConvertManifest`,
  `Diagnostic`, `DiagnosticSeverity`, `SourceSpan`,
  `ConverterCapabilities`.
- Error: `ConverterNotReadyError` with a `missingLayer` discriminator.

## Minimum-viable API call

```ts
import {
    convert,
    ConverterNotReadyError,
} from "@invinite-org/chartlang-pine-converter";

try {
    const result = convert("//@version=6\nindicator('hello')");
    void result;
} catch (err) {
    if (err instanceof ConverterNotReadyError) {
        // Layer not yet implemented (e.g. "lexer") — see the tasklist.
        void err.missingLayer;
    }
}
```

## Docs

See [`docs/converter/`](../../docs/converter/) (populated by Task 20).

## License

MIT
