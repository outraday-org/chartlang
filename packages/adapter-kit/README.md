# @invinite-org/chartlang-adapter-kit

`experimental`

SDK for writing chartlang adapters in consumer repos.

## Install

```bash
pnpm add @invinite-org/chartlang-adapter-kit
```

## Public surface

Planned (Phase 1+): `defineAdapter(opts) → Adapter`; types `Adapter`, `Capabilities`, `CandleEvent`; capability builders (`capabilities.line()`, `capabilities.histogram()`, …); `validateEmission`, `decodeDrawing`; mock candle sources; base classes `PassThroughAdapter`, `BufferingAdapter`.

## Minimum-viable API call

```ts
import { PACKAGE_VERSION } from "@invinite-org/chartlang-adapter-kit";
console.log(PACKAGE_VERSION); // "0.0.0"
```

## Docs

See [`docs/adapters/contract.md`](../../docs/adapters/contract.md).

## License

MIT
