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
  of a `Capabilities` bag. Phase 1+2: `line()`, `stepLine()`,
  `horizontalLine()`, `allLines()`, `histogram()`, `bars()`,
  `area()`, `filledBand()`, `label()`, `marker()`,
  `allPhase2Plots()`, `alerts(...)`, `union(...)`. Phase 3: 61
  per-kind drawing builders (`drawLine()`, `drawFibRetracement()`,
  …), 13 category groups (`allLineDrawings()`, `allFibDrawings()`,
  `allElliottDrawings()`, …), and `allPhase3Drawings()`.
- `validateEmission(e) → ValidationResult` — hand-rolled validator
  enforcing PLAN §7.3 universal payload rules. Phase 3 dispatches
  drawings per kind (line-kind validators land in this PR; remaining
  kinds land per port task per §22.10).
- `decodeDrawing(e) → DrawingState | null` — narrows a
  `DrawingEmission` to its typed `DrawingState`; returns `null` on
  validation failure.
- `bucketFor(kind) → DrawingBucket` + `KIND_BUCKET` — kind → bucket
  map re-exported from `@invinite-org/chartlang-core` for adapters
  that pre-budget against the canonical 5-bucket table.
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
