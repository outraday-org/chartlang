# Writing an adapter

This tutorial walks a chart integration from an empty scaffold to a
package that declares its capabilities honestly, feeds candles, translates
emissions, and publishes a reproducible conformance report.

## Prerequisites

Use Node 20 or newer and a package manager that can run the scaffolded
scripts. Install the CLI in the adapter repo, then scaffold a package:

```bash
pnpm dlx @invinite-org/chartlang-cli scaffold-adapter lightweight-demo
cd lightweight-demo
pnpm install
```

The generated package is intentionally private. Adapter packages live in
consumer repositories and are published under the owner's scope when they
are ready.

## Scaffold

The scaffold contains the adapter source, a smoke test, a conformance test,
and a report script:

```text
src/index.ts
src/index.test.ts
src/conformance.test.ts
scripts/conformance-report.ts
package.json
tsconfig.json
README.md
```

Run the starting checks before editing:

```bash
pnpm test
pnpm conformance:report
```

`pnpm test` runs both the smoke test and `src/conformance.test.ts`.
`pnpm conformance:report` writes `CONFORMANCE.md` and
`conformance-report.json` at the package root.

## The Adapter Interface

An adapter is a single object accepted by
`@invinite-org/chartlang-adapter-kit`:

```ts
import { defineAdapter, mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
import type { Adapter, CandleEvent, RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";

async function* candles(): AsyncIterable<CandleEvent> {
    yield { kind: "history", bars: [] };
}

function onEmissions(emissions: RunnerEmissions): void {
    for (const plot of emissions.plots) {
        console.log(plot.slotId, plot.style.kind, plot.value);
    }
}

export const adapter: Adapter = defineAdapter({
    id: "demo",
    name: "Demo",
    capabilities: {
        plots: new Set(["line"]),
        drawings: new Set(),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        maxLookback: 5000,
        maxTickHz: 10,
    },
    candles: () => mockCandleSource([]),
    onEmissions,
    dispose: () => {},
});
```

`candles(opts)` receives `{ interval }`. The main chart interval is
`"chart"`; secondary streams use the exact interval values declared in
`capabilities.intervals`.

`onEmissions(emissions)` receives the adapter-facing batch described in
[the emissions spec](../spec/emissions.md): plots, drawings, alerts,
alert conditions, logs, diagnostics, and the inclusive bar range covered
by the batch.

`dispose()` releases chart subscriptions, series instances, DOM handles,
workers, and timers owned by the adapter.

## Capabilities

Capabilities are a promise, not a wish list. If a kind is not declared,
the runtime turns that script primitive into a silent no-op plus a
diagnostic instead of asking the adapter to render it.

```ts
import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";

export const chartCapabilities: Capabilities = {
    plots: capabilities.union(capabilities.line(), capabilities.area()),
    drawings: new Set(["line", "horizontal-line"]),
    alerts: new Set(["toast"]),
    alertConditions: false,
    logs: true,
    inputs: new Set(["int", "float", "bool", "color", "source"]),
    intervals: [{ value: "1D", label: "1 day", group: "daily" }],
    multiTimeframe: true,
    subPanes: 1,
    symInfoFields: new Set(["ticker", "mintick", "timezone"]),
    maxDrawingsPerScript: { lines: 100, labels: 0, boxes: 0, polylines: 0, other: 0 },
    maxLookback: 5000,
    maxTickHz: 10,
};
```

Do not declare `area` until you create or update an area series. Do not
declare `horizontal-line` until you can create, update, and remove the
corresponding drawing state. Do not declare `multiTimeframe` unless
`candles({ interval })` can deliver secondary streams for every listed
interval.

## Candle Plumbing

Adapters deliver three candle event kinds:

```ts
import type { Bar, IntervalDescriptor } from "@invinite-org/chartlang-core";
import type { CandleEvent } from "@invinite-org/chartlang-adapter-kit";

async function* streamChartCandles(loadHistory: () => Promise<ReadonlyArray<Bar>>): AsyncIterable<CandleEvent> {
    yield { kind: "history", bars: await loadHistory() };

    for await (const bar of liveClosedBars()) {
        yield { kind: "close", bar };
    }
}

async function* streamTicks(): AsyncIterable<CandleEvent> {
    for await (const bar of liveTickBars()) {
        yield { kind: "tick", bar };
    }
}

declare function liveClosedBars(): AsyncIterable<Bar>;
declare function liveTickBars(): AsyncIterable<Bar>;
```

Use `history` for warm-up data, `close` when a bar is final, and `tick`
when the still-open bar changes. Scripts that use tick state see every
`tick`; close-only scripts get deterministic final-bar behavior.

For multi-timeframe data, tag secondary events with the requested
stream key:

```ts
const daily: IntervalDescriptor = { value: "1D", label: "1 day", group: "daily" };
declare const dailyBar: Bar;
const event: CandleEvent = { kind: "close", streamKey: daily.value, bar: dailyBar };
```

## Translating Plot Emissions

Plot emissions are append/update records keyed by `slotId`. Keep a map
from `slotId` to the chart-library series you create for that plot kind:

```ts
import type { PlotEmission } from "@invinite-org/chartlang-adapter-kit";

const seriesBySlot = new Map<string, unknown>();

function renderPlot(plot: PlotEmission): void {
    if (plot.value === null) return;

    switch (plot.style.kind) {
        case "line":
            updateLineSeries(seriesBySlot, plot.slotId, plot.time, plot.value, plot.color);
            return;
        case "area":
            updateAreaSeries(seriesBySlot, plot.slotId, plot.time, plot.value, plot.color);
            return;
        case "horizontal-line":
            updatePriceLine(seriesBySlot, plot.slotId, plot.value, plot.color);
            return;
        default:
            return;
    }
}

declare function updateLineSeries(
    series: Map<string, unknown>,
    slotId: string,
    time: number,
    value: number,
    color: string | null,
): void;
declare function updateAreaSeries(
    series: Map<string, unknown>,
    slotId: string,
    time: number,
    value: number,
    color: string | null,
): void;
declare function updatePriceLine(
    series: Map<string, unknown>,
    slotId: string,
    value: number,
    color: string | null,
): void;
```

Unsupported kinds should be absent from `capabilities.plots`; the runtime
will gate them before they reach this function.

## Translating Drawing Emissions

Drawing emissions are keyed by `handleId` and use `op` to describe
lifecycle:

```ts
import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";

const drawingsByHandle = new Map<string, unknown>();

function renderDrawing(emission: DrawingEmission): void {
    if (emission.op === "remove") {
        removeDrawing(drawingsByHandle, emission.handleId);
        return;
    }

    switch (emission.drawingKind) {
        case "line":
            upsertLineDrawing(drawingsByHandle, emission.handleId, emission.state);
            return;
        case "horizontal-line":
            upsertHorizontalLineDrawing(drawingsByHandle, emission.handleId, emission.state);
            return;
        default:
            return;
    }
}

declare function removeDrawing(drawings: Map<string, unknown>, handleId: string): void;
declare function upsertLineDrawing(drawings: Map<string, unknown>, handleId: string, state: unknown): void;
declare function upsertHorizontalLineDrawing(
    drawings: Map<string, unknown>,
    handleId: string,
    state: unknown,
): void;
```

`create` and `update` both carry full state, not a patch. Treat `update`
as replace-or-mutate in place. Treat `remove` as idempotent.

## Running Conformance Locally

The generated test is deliberately not skipped:

```ts
import { runConformanceSuite } from "@invinite-org/chartlang-conformance";
import { describe, expect, it } from "vitest";

import adapter from "./index.js";

describe("conformance", () => {
    it("passes the full chartlang conformance suite", async () => {
        const report = await runConformanceSuite(adapter);
        expect(report.failures).toEqual([]);
        expect(report.failed).toBe(0);
    });
});
```

Run it with:

```bash
pnpm test
```

If a scenario fails because the adapter cannot render a kind, remove that
kind from the capability bag. If it fails because the adapter claims a
kind and renders the wrong wire shape, fix the translation.

## Publishing Your Report

The generated report script uses the public renderers:

```ts
import {
    renderConformanceJson,
    renderConformanceMarkdown,
    runConformanceSuite,
} from "@invinite-org/chartlang-conformance";
```

Run:

```bash
pnpm conformance:report
```

Commit both `CONFORMANCE.md` and `conformance-report.json`. The Markdown
file is the human signal; the JSON sidecar is for CI and docs tooling.

## Publishing to npm

Consumer repositories own production adapters:

1. Install `@invinite-org/chartlang-adapter-kit`,
   `@invinite-org/chartlang-host-worker`, and
   `@invinite-org/chartlang-conformance`.
2. Scaffold an adapter or copy the Canvas2D reference structure.
3. Implement `Adapter` against the target chart.
4. Declare `Capabilities` honestly.
5. Run conformance in CI and publish the report pair.
6. Remove `"private": true`, choose a package name under your own scope,
   and publish with normal npm provenance.
7. Keep the package private instead when the chart integration is internal.

The chartlang repo does not add third-party adapter packages or maintain a
central adapter registry. The contract, conformance suite, and published
report are the interoperability signal.
