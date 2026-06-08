# @invinite-org/chartlang-compiler

`experimental`

TypeScript transformer + bundler for `.chart.ts` files. It builds deterministic
programs, rejects unsupported language constructs, injects slot ids, extracts
manifests, bundles ESM, and emits declaration siblings.

## Install

```bash
pnpm add @invinite-org/chartlang-compiler
```

## Public surface

- `compile(source, opts)` — compile a script string to module source,
  sourcemap, manifest, and `.d.ts` text.
- `compileFile(path, opts)` — compile one `.chart.ts` and atomically write
  `<base>.chart.js`, `<base>.chart.manifest.json`, and `<base>.chart.d.ts`.
- `compileProject(rootDir, opts)` — path-sorted in-memory project compile.
- `transformAndAnalyse(source, opts)` — run AST passes without bundling.
- Extractors: `extractCapabilities`, `extractInputs`,
  `extractRequestedIntervals`, `extractRequiresIntervals`, and max-lookback /
  drawing-budget helpers.
- Errors and types: `CompileError`, `CompileDiagnostic`,
  `CompileDiagnosticCode`, `CompiledScript`, `CompileOptions`,
  `CompileFileOptions`, `BundleModuleOptions`, `EmitTypesOptions`.
- Phase 4 diagnostics include `input-call-not-literal`,
  `input-schema-not-literal`, `requires-intervals-not-literal`, and
  `request-security-interval-not-literal`.

## Minimum-viable API call

```ts
import { compile } from "@invinite-org/chartlang-compiler";

const result = await compile(source, {
    apiVersion: 1,
    sourcePath: "indicator.chart.ts",
});

console.log(result.manifest.inputs);
console.log(result.manifest.requestedIntervals);
```

## Docs

See [`docs/spec/grammar.md`](../../docs/spec/grammar.md).

## License

MIT
