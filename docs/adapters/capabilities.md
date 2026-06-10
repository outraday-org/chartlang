# Adapter capabilities

`Capabilities` is the capability bag every adapter declares. It is the
runtime's source of truth for what each chart can render. The runtime
gates every plot, drawing, alert, log, and request through this bag —
unsupported emissions drop with a documented diagnostic instead of
reaching `onEmissions`.

This page is the field-by-field reference. See
[Adapter contract](./contract.md) for the `Adapter` interface that
carries it, and
[Execution semantics § Capability Fallback](../spec/semantics.md#capability-fallback)
for the normative drop-and-diagnose rules.

## The shape

```ts
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";

const example: Capabilities = {
    plots: new Set(["line"]),
    drawings: new Set(),
    alerts: new Set(["toast"]),
    alertConditions: false,
    logs: false,
    inputs: new Set(),
    intervals: [],
    multiTimeframe: false,
    subPanes: 0,
    symInfoFields: new Set(),
    maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
    maxLookback: 5_000,
    maxTickHz: 10,
};
void example;
```

There are 13 keys. Every key is required — chartlang prefers an
explicit empty `Set<...>` over an absent field.

| Key | Type | Gates |
| --- | --- | --- |
| `plots` | `ReadonlySet<PlotKind>` | `PlotEmission.style.kind`. Missing kinds drop with `unsupported-plot-kind`. |
| `drawings` | `ReadonlySet<DrawingKind>` | `DrawingEmission.drawingKind`. Missing kinds drop with `unsupported-drawing-kind`. |
| `alerts` | `ReadonlySet<AlertChannel>` | `alert(...)` calls. Empty set drops with `unsupported-alert-channel`. |
| `alertConditions` | `boolean` | `signal(id, fired)` from `defineAlertCondition`. `false` drops with `alert-conditions-not-supported`. |
| `logs` | `boolean` | `runtime.log.*`. `false` is a silent no-op (no diagnostic — logs are debug output). |
| `inputs` | `ReadonlySet<InputKind>` | Which input kinds the adapter can render in a settings UI. Out-of-set inputs use the manifest default; no editor renders for them. |
| `intervals` | `ReadonlyArray<IntervalDescriptor>` | Which timeframes `candles({ interval })` can deliver. `request.security`/`request.lowerTf` must name an entry here. |
| `multiTimeframe` | `boolean` | Whether the adapter can deliver more than one candle stream per script. `false` triggers an all-NaN fallback for `request.security` and an empty bucket for `request.lowerTf` with `multi-timeframe-not-supported`. |
| `subPanes` | `number` | Max sub-panes the chart can render. `0` folds non-overlay plots to overlay with `unsupported-pane`. Use `Number.MAX_SAFE_INTEGER` as the unlimited sentinel. |
| `symInfoFields` | `ReadonlySet<SymInfoField>` | Which `syminfo.*` fields the adapter populates. Missing fields read as empty sentinels per [semantics § symbol metadata](../spec/semantics.md). |
| `maxDrawingsPerScript` | `DrawingCounts` | Per-bucket drawing budget. The runtime enforces `min(this, manifest.maxDrawings)` per bucket and drops overflow creates with `drawing-budget-exceeded`. |
| `maxLookback` | `number` | Hard ceiling on series ring-buffer capacity. The runtime sizes buffers to at most this many slots. |
| `maxTickHz` | `number` | Adapter-declared tick rate ceiling. Informational for embedders sizing watchdogs. |

## Capability honesty

Two rules every adapter author must internalise:

1. **A capability is a promise, not a wish list.** Do not declare
   `area` until the adapter creates or updates an area series. Do not
   declare `horizontal-line` (drawing kind) until the adapter can
   create, update, **and** remove the corresponding drawing state. Do
   not declare `multiTimeframe: true` unless `candles({ interval })`
   can deliver secondary streams for every listed interval.
2. **The runtime, not the adapter, drops unsupported work.** A script
   that calls a primitive outside the adapter's capability set never
   reaches `onEmissions` with a payload the adapter cannot render. The
   adapter just sees diagnostics for the dropped emissions and can
   surface them to the developer.

## Capability builders

`@invinite-org/chartlang-adapter-kit` exports a `capabilities` helper
that builds the plot, drawing, and other sets:

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
        logs: true,
        inputs: new Set(["int", "float", "bool", "color", "source"]),
        intervals: [{ value: "1D", label: "1 day", group: "daily" }],
        multiTimeframe: false,
        subPanes: 1,
        symInfoFields: new Set(["ticker", "mintick", "timezone"]),
        maxDrawingsPerScript: { lines: 100, labels: 50, boxes: 10, polylines: 10, other: 5 },
        maxLookback: 5_000,
        maxTickHz: 10,
    },
    candles: () => mockCandleSource([], { interval: "1D" }),
    onEmissions: () => {},
});
```

The builders cover plot kinds (`capabilities.line()`,
`capabilities.allLines()`, `capabilities.histogram()`,
`capabilities.area()`, ...), drawing groups, alert channels, intervals,
sub-pane counts, syminfo-field sets, drawing-budget objects, and the
boolean `alertConditions` / `logs` / `multiTimeframe` toggles. Use
them; do not hand-roll the underlying `Set`s.

## Capability is `apiVersion: 1`-stable

The 13 keys are pinned. Within `1.x`, additive optional fields and
additive `PlotKind`/`DrawingKind` values are allowed and older adapters
can ignore them — the runtime gates additive kinds as capability
mismatches, not as schema corruption. Renames, removals, and meaning
changes require `apiVersion: 2`. See
[apiVersion contract](../spec/versioning.md).

## Cross-links

- The `Adapter` shape that carries this bag: [Adapter contract](./contract.md).
- The drop-and-diagnose rules per surface:
  [Execution semantics § Capability Fallback](../spec/semantics.md#capability-fallback).
- Wire-side gating tables:
  [Emission payloads § Capability Gating](../spec/emissions.md#capability-gating).
- Step-by-step build: [Writing an adapter](./writing-an-adapter.md).
- Conformance check: [Conformance](./conformance.md).
