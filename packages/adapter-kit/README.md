# @invinite-org/chartlang-adapter-kit

`experimental`

SDK for writing chartlang adapters in consumer repos. It ships the adapter
contract, capabilities model, emission validators, mock candles, and test base
classes.

## Install

```bash
pnpm add @invinite-org/chartlang-adapter-kit
```

## Public surface

- `defineAdapter(opts) -> Adapter` — factory preserving optional hooks such as
  `symInfo` and `resolveInputs`.
- `capabilities` — builders for plots, alerts, 61 drawing kinds, drawing
  groups, and Phase 4 capability fields: `intervals(...)`,
  `multiTimeframe(...)`, `subPanes(...)`, `symInfoFields(...)`,
  `maxDrawingsPerScript(...)`, `alertConditions(...)`, and `logs(...)`.
- `validateEmission(e) -> ValidationResult` — validates plot, alert, drawing,
  diagnostic, log, and alert-condition payloads.
- `decodeDrawing(e) -> DrawingState | null`.
- `bucketFor(kind)`, `KIND_BUCKET`, and drawing kind maps from core.
- `mockCandleSource(bars, opts)` for tests and conformance scenarios.
- `PassThroughAdapter`, `BufferingAdapter`.
- Types: `Adapter`, `Capabilities`, `CandleEvent`, emissions, diagnostics,
  input kinds, `SymInfoField`, `RunnerEmissions`, and `DefineAdapterOpts`.

## Minimum-viable API call

```ts
import { capabilities, defineAdapter, mockCandleSource } from "@invinite-org/chartlang-adapter-kit";

export default defineAdapter({
    id: "demo",
    name: "Demo",
    capabilities: {
        plots: capabilities.allLines(),
        drawings: new Set(),
        alerts: capabilities.alerts("toast"),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: capabilities.intervals([{ value: "1D", label: "1 day", group: "daily" }]).intervals,
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        maxLookback: 5000,
        maxTickHz: 10,
    },
    candles: () => mockCandleSource([], { interval: "1D" }),
    onEmissions: () => {},
});
```

## Docs

See [`docs/adapters/contract.md`](../../docs/adapters/contract.md).

## License

MIT
