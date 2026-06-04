# @invinite-org/chartlang-compiler

`experimental`

TypeScript transformer + bundler for `.chart.ts` files. Phase 1 ships the
full pipeline: program construction, callsite-id injection per §5.5,
static-analysis passes that reject forbidden constructs, manifest
extraction, esbuild bundling, and a minimal `.d.ts` sibling.

## Install

```bash
pnpm add @invinite-org/chartlang-compiler
```

## Public surface

- `compile(source, opts)` — compile a script source string. Returns a immutable
  `CompiledScript` with `moduleSource` (ESM, with appended
  `export const __manifest = …;`), optional external `sourcemap`,
  `manifest`, and `types` (.d.ts source). Throws `CompileError` on any
  error-severity diagnostic.
- `compileFile(path, opts)` — read a `.chart.ts` from disk, compile it, and
  (when `opts.write !== false`) write the three sibling files atomically:
  `<base>.chart.js`, `<base>.chart.manifest.json`, `<base>.chart.d.ts`.
  Honours `sourcemap: "inline" | "external" | false`.
- `compileProject(rootDir, opts)` — discover every `*.chart.ts` under
  `rootDir` (skipping `node_modules` / `dist`) and compile each in
  parallel. Returns a immutable array in path-sorted order; in-memory only.
- `CompileError` — thrown by the three APIs; `err.diagnostics` carries the
  full immutable `CompileDiagnostic[]`.
- `transformAndAnalyse(source, opts)` — lower-level driver that runs the
  AST passes without bundling. Useful for editors / language servers.
- `CompileDiagnostic`, `CompileDiagnosticCode`, `BundleModuleOptions`,
  `BundleModuleResult`, `EmitTypesOptions`, `CompiledScript`,
  `CompileOptions`, `CompileFileOptions`.

## Minimum-viable API call

```ts
import { compile } from "@invinite-org/chartlang-compiler";

const source = `
    import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
    export default defineIndicator({
        name: "EMA(20)",
        apiVersion: 1,
        compute: ({ bar }) => { plot(ta.ema(bar.close, 20)); },
    });
`;

const result = await compile(source, {
    apiVersion: 1,
    sourcePath: "ema.chart.ts",
});

console.log(result.manifest.capabilities); // ["indicators"]
console.log(result.moduleSource.includes("__manifest")); // true
```

## Docs

See [`docs/spec/grammar.md`](../../docs/spec/grammar.md).

## License

MIT
