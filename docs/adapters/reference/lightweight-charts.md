# Lightweight Charts walkthrough

This page is the contract-side walkthrough for a Lightweight Charts
adapter. It maps chartlang emissions and capabilities onto the public
Lightweight Charts API, then shows how to publish the conformance report.
It does not add a Lightweight Charts adapter package to this repository.

Lightweight Charts 5.2 creates built-in series with `chart.addSeries(...)`,
including candlestick, line, area, bar, and histogram series. Its series
API accepts full replacement data through `setData(...)`, incremental
updates through `update(...)`, price lines through `createPriceLine(...)`,
and attached drawing primitives through `attachPrimitive(...)`. See the
official docs for [series types](https://tradingview.github.io/lightweight-charts/docs/series-types),
[series API](https://tradingview.github.io/lightweight-charts/docs/api/interfaces/ISeriesApi),
and [plugins](https://tradingview.github.io/lightweight-charts/docs/plugins/intro).

## Capability Mapping

| Lightweight Charts feature | chartlang kind | Declare support? | Mapping |
| --- | --- | --- | --- |
| Candlestick series | candle stream | yes | Feed `history` through `setData`; feed `close` and `tick` through `update`. |
| Line series | `PlotKind: "line"` | yes | One line series per `slotId`; append `{ time, value }`. |
| Area series | `PlotKind: "area"` | yes | One area series per `slotId`; map chartlang color into line/top/bottom options. |
| Price line | `PlotKind: "horizontal-line"` | yes | Use `createPriceLine` on an anchor series; replace the line when value/style changes. |
| Histogram series | `PlotKind: "histogram"` | optional | Declare only if column styling is implemented. |
| Series markers | `PlotKind: "marker"`, `"shape"`, `"character"`, `"arrow"` | optional | Implement through the markers plugin or declare unsupported. |
| Candle/bar styling | `"candle-override"`, `"bar-override"`, `"bg-color"`, `"bar-color"` | optional | Declare only after the adapter owns style mutation and restoration. |
| Series primitives | simple drawing kinds | yes for implemented kinds | Lines, rays, rectangles, text, and markers can be custom primitives attached to a series. |
| Pane primitives | pane-level drawing kinds | optional | Use for chart-wide annotations that should not be tied to one series. |
| Complex drawing tools | fib, Gann, Elliott, pitchfork, pattern kinds | usually no | Declare unsupported until custom primitive geometry is implemented and tested. |
| Multi-pane API | `subPanes` | optional | Declare the exact extra pane count the adapter creates and manages. |
| Secondary candle streams | `multiTimeframe` + `intervals` | optional | Declare only if the data layer can deliver every interval listed. |

## Honest Capabilities

A minimal Lightweight Charts adapter can start with line, area, and
horizontal-line plots plus a small drawing subset:

```ts
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";

export const lightweightCapabilities: Capabilities = {
    plots: new Set(["line", "area", "horizontal-line"]),
    drawings: new Set(["line", "horizontal-line", "rectangle", "text"]),
    alerts: new Set(["toast"]),
    alertConditions: false,
    logs: true,
    inputs: new Set(["bool", "color", "float", "int", "source", "string"]),
    intervals: [{ value: "1D", label: "1 day", group: "daily" }],
    multiTimeframe: true,
    subPanes: 1,
    symInfoFields: new Set(["ticker", "mintick", "timezone"]),
    maxDrawingsPerScript: { lines: 100, labels: 100, boxes: 100, polylines: 0, other: 0 },
    maxLookback: 5000,
    maxTickHz: 10,
};
```

If the implementation has no custom primitives yet, use
`drawings: new Set()` and set every drawing budget to `0`. Capability
honesty is what lets chartlang degrade unsupported primitives into silent
no-ops plus diagnostics.

## Candle Events

Use one candlestick series for the chart's own OHLC data. Historical data
maps to `setData`; close and tick events map to `update`:

```ts
import type { Bar } from "@invinite-org/chartlang-core";
import type { CandleEvent } from "@invinite-org/chartlang-adapter-kit";

type LwcCandle = {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
};

function toLwcCandle(bar: Bar): LwcCandle {
    return {
        time: Math.floor(bar.time / 1000),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
    };
}

function applyCandleEvent(series: { setData(data: LwcCandle[]): void; update(data: LwcCandle): void }, event: CandleEvent): void {
    if (event.kind === "history") {
        series.setData(event.bars.map(toLwcCandle));
        return;
    }

    series.update(toLwcCandle(event.bar));
}
```

For secondary streams, route `candles({ interval })` to the data source
for that interval and emit events with the same `streamKey` value.

## Plot Emissions

Maintain one Lightweight Charts series or price-line handle per chartlang
`slotId`:

```ts
import type { PlotEmission } from "@invinite-org/chartlang-adapter-kit";

const plotHandles = new Map<string, unknown>();

function applyPlot(plot: PlotEmission): void {
    if (plot.value === null) return;

    switch (plot.style.kind) {
        case "line":
            updateLine(plotHandles, plot.slotId, plot.time, plot.value, plot.color);
            return;
        case "area":
            updateArea(plotHandles, plot.slotId, plot.time, plot.value, plot.color);
            return;
        case "horizontal-line":
            updatePriceLine(plotHandles, plot.slotId, plot.value, plot.color);
            return;
        default:
            return;
    }
}

declare function updateLine(handles: Map<string, unknown>, slotId: string, time: number, value: number, color: string | null): void;
declare function updateArea(handles: Map<string, unknown>, slotId: string, time: number, value: number, color: string | null): void;
declare function updatePriceLine(handles: Map<string, unknown>, slotId: string, value: number, color: string | null): void;
```

The production implementation should convert chartlang millisecond times
to the Lightweight Charts horizontal scale item it uses, usually seconds
for business-time series or a typed `BusinessDay`. An optional
`plot.xShift` (signed integer bars) is a presentation-only display shift —
to honour it, offset the converted time by `xShift` bars before plotting;
omitting it renders the series at its own bar and stays correct.

## Drawing Emissions

Lightweight Charts primitives are the right place for supported drawings.
Start with simple geometry:

| `DrawingKind` | Suggested LWC implementation |
| --- | --- |
| `line` | Series primitive with two world anchors. |
| `horizontal-line` | Price line when no custom hit testing is needed; primitive when lifecycle styling must match chartlang exactly. |
| `rectangle` | Series or pane primitive projecting two time/price anchors. |
| `text` | Series primitive anchored to one time/price point. |
| `marker` | Marker plugin or primitive, depending on required labels and hit testing. |

Keep fib, Gann, Elliott, pitchfork, cyclic, and pattern kinds declared
unsupported until their geometry, lifecycle, and style mapping are real.

```ts
import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";

const drawingHandles = new Map<string, unknown>();

function applyDrawing(emission: DrawingEmission): void {
    if (emission.op === "remove") {
        detachPrimitive(drawingHandles, emission.handleId);
        return;
    }

    switch (emission.drawingKind) {
        case "line":
        case "horizontal-line":
        case "rectangle":
        case "text":
            upsertPrimitive(drawingHandles, emission.handleId, emission.state);
            return;
        default:
            return;
    }
}

declare function detachPrimitive(handles: Map<string, unknown>, handleId: string): void;
declare function upsertPrimitive(handles: Map<string, unknown>, handleId: string, state: unknown): void;
```

## Emission Dispatch

The adapter dispatch point is ordinary chartlang `onEmissions`:

```ts
import type { RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";

export function onEmissions(emissions: RunnerEmissions): void {
    for (const plot of emissions.plots) applyPlot(plot);
    for (const drawing of emissions.drawings) applyDrawing(drawing);
    for (const alert of emissions.alerts) showToast(alert.message);
    for (const log of emissions.logs) console.info(log.message, log.meta ?? {});
}

declare function applyPlot(plot: RunnerEmissions["plots"][number]): void;
declare function applyDrawing(drawing: RunnerEmissions["drawings"][number]): void;
declare function showToast(message: string): void;
```

Diagnostics are not rendered as chart objects. Surface them to the
adapter's developer console, debug pane, or error-reporting path.

## Conformance Report

The generated scaffold includes:

```bash
pnpm test
pnpm conformance:report
```

Run both in the Lightweight Charts adapter repo. Commit the generated
`CONFORMANCE.md` and `conformance-report.json` there. The report should
be regenerated whenever the adapter capability bag or rendering behavior
changes.

The adapter package lives in its own repo per §15 — this page is the
contract-side walkthrough.
