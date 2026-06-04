# @invinite-org/chartlang-compiler

`experimental`

TypeScript transformer + bundler for .chart.ts files.

## Install

```bash
pnpm add @invinite-org/chartlang-compiler
```

## Public surface

Planned (Phase 1+): `compile(source, opts) → CompiledScript`, `compileFile`, `compileProject`.

## Minimum-viable API call

```ts
import { PACKAGE_VERSION } from "@invinite-org/chartlang-compiler";
console.log(PACKAGE_VERSION); // "0.0.0"
```

## Docs

See [`docs/spec/grammar.md`](../../docs/spec/grammar.md).

## License

MIT
