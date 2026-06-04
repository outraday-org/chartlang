# @invinite-org/chartlang-runtime

`experimental`

Execution engine, Series ring buffers, ta.* math primitives.

## Install

```bash
pnpm add @invinite-org/chartlang-runtime
```

## Public surface

Planned (Phase 1+): `createScriptRunner(compiled, ctx) → ScriptRunner`; types for `ScriptHost`, `Adapter`, `Capabilities`.

## Minimum-viable API call

```ts
import { PACKAGE_VERSION } from "@invinite-org/chartlang-runtime";
console.log(PACKAGE_VERSION); // "0.0.0"
```

## Docs

See [`docs/spec/semantics.md`](../../docs/spec/semantics.md).

## License

MIT
