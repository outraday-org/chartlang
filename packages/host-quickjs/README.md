# @invinite-org/chartlang-host-quickjs

`experimental`

QuickJS-WASM ScriptHost for untrusted / server-side execution.

## Install

```bash
pnpm add @invinite-org/chartlang-host-quickjs
```

## Public surface

Planned (Phase 1+): `createQuickJsHost() → ScriptHost`.

## Minimum-viable API call

```ts
import { PACKAGE_VERSION } from "@invinite-org/chartlang-host-quickjs";
console.log(PACKAGE_VERSION); // "0.0.0"
```

## Docs

See [`docs/hosts/quickjs.md`](../../docs/hosts/quickjs.md).

## License

MIT
