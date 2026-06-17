# @invinite-org/chartlang-pine-converter

`experimental`

Pine Script v6 → chartlang source-to-source converter (drawings v1).
Takes a Pine v6 script string, emits an equivalent `.chart.ts` chartlang
script string plus structured diagnostics for any idiom that cannot be
faithfully translated. The v1 slice covers the Pine drawing surface
(`line.*`, `label.*`, `box.*`, `table.*`, `polyline.*`, `linefill.*`)
plus the minimum supporting infrastructure (indicator declaration,
inputs, `var`/`varip`, `barstate`, literal-bounded control flow).

The pipeline runs lexer → parser → semantic analysis → mapping → the
transform passes (declaration, inputs, the three drawing camps, tables,
polyline/linefill, control flow) → codegen, returning structured
diagnostics with versioned codes and 1-based source spans.

## Install

```bash
pnpm add @invinite-org/chartlang-pine-converter
```

## Public surface

- `convert(source, opts?) → ConvertResult` — synchronous source-to-source
  conversion. Returns `{ output, manifest, diagnostics }`; `output` is the
  chartlang `.chart.ts` string (or `null` when lex/parse fails fatally).
- `convertFile(path, opts?) → Promise<ConvertResult>` — async fs wrapper:
  reads `path`, converts, and writes the output to `opts.outPath` when set.
- Types: `ConvertOpts`, `ConvertFileOpts`, `ConvertResult`, `ConvertManifest`,
  `Diagnostic`, `DiagnosticSeverity`, `SourceSpan`, `ConverterCapabilities`.
- Sub-export `@invinite-org/chartlang-pine-converter/diagnostics` —
  `formatDiagnostic`, `formatDiagnosticReport`, `formatDiagnosticsJson`,
  `DiagnosticReport`, `upgradeWarningsToErrors`.
- Error: `ConverterNotReadyError` with a `missingLayer` discriminator.

## Minimum-viable API call

```ts
import { convert } from "@invinite-org/chartlang-pine-converter";

const result = convert("//@version=6\nindicator('hello')");
if (result.output !== null) {
    // result.output is a chartlang `.chart.ts` source string that
    // compiles through @invinite-org/chartlang-compiler.
    void result.output;
}
void result.manifest;
void result.diagnostics;
```

## Docs

See [`docs/converter/`](../../docs/converter/) — overview, CLI +
programmatic [usage](../../docs/converter/usage.md),
[supported surface](../../docs/converter/supported.md),
[rejects + manual rewrites](../../docs/converter/rejects.md), and the
generated [diagnostics reference](../../docs/converter/diagnostics.md). The
author-focused porting guide is the
[`translating-from-pine`](../../skills/chartlang-coding/references/translating-from-pine.md)
skill reference.

**Deferred:** the side-by-side converter example doc pages are pending the
Task 19 fixture corpus.

## License

MIT
