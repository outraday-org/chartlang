# @invinite-org/chartlang-adapter-kit

`experimental`

SDK for writing chartlang adapters in consumer repos. Ships the
`Adapter` / `Capabilities` / `CandleEvent` contract, the §7.3 emission
shapes, a hand-rolled `validateEmission` validator, capability
builders, a mock candle source, and `PassThroughAdapter` /
`BufferingAdapter` base classes.

## Install

```bash
pnpm add @invinite-org/chartlang-adapter-kit
```

## Public surface

- `defineAdapter(opts) → Adapter` — factory with default no-op
  `dispose`.
- `capabilities` — builders that assemble the `ReadonlySet` pieces
  of a `Capabilities` bag (`line()`, `stepLine()`,
  `horizontalLine()`, `allLines()`, `alerts(...)`, `union(...)`).
- `validateEmission(e) → ValidationResult` — hand-rolled validator
  enforcing PLAN §7.3 universal payload rules.
- `decodeDrawing(e) → null` — Phase-1 stub; full discriminated
  decoder lands in Phase 3.
- `mockCandleSource(bars, opts)` — `AsyncIterable<CandleEvent>` for
  tests and conformance scenarios.
- `PassThroughAdapter`, `BufferingAdapter` — base classes for
  runtime tests and reference adapters.
- Types: `Adapter`, `Capabilities`, `CandleEvent`, `PlotKind`,
  `PlotStyle`, `PlotEmission`, `AlertChannel`, `AlertEmission`,
  `DrawingKind`, `DrawingEmission`, `DrawingCounts`, `InputKind`,
  `SymInfoField`, `RuntimeDiagnostic`, `DiagnosticCode`,
  `RunnerEmissions`, `ValidationResult`, `MockCandleSourceMode`,
  `MockCandleSourceOpts`, `DefineAdapterOpts`.

## Minimum-viable API call

```ts
import {
    defineAdapter,
    capabilities,
    mockCandleSource,
} from "@invinite-org/chartlang-adapter-kit";

const adapter = defineAdapter({
    id: "demo",
    name: "Demo",
    capabilities: {
        plots: capabilities.allLines(),
        drawings: new Set(),
        alerts: capabilities.alerts("toast"),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: {
            lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0,
        },
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
