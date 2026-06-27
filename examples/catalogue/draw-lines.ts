// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExampleMeta } from "../catalogue";

const entries: ReadonlyArray<ExampleMeta> = [
    {
        id: "pivot-arrow",
        label: "Pivot Arrow",
        description:
            "draw.arrow — track the latest confirmed swing low in state.* slots (recovered 5 bars back via bar.point(-5, …)) and draw one reused directional arrow from it up to the current bar, with a label near the shaft.",
        category: "draw-lines",
        primitives: ["draw.arrow"],
    },
    {
        id: "swing-high-level",
        label: "Swing High Level",
        description:
            "draw.horizontalLine — hold a full-width horizontal level at the most recent confirmed swing high; the single reused line jumps up to each new pivot high as it confirms.",
        category: "draw-lines",
        primitives: ["draw.horizontalLine"],
    },
    {
        id: "cross-event-marker",
        label: "Cross Event Marker",
        description:
            "draw.verticalLine — drop a full-height vertical marker on the bar where a fast EMA(9) crosses above a slow EMA(21) (ta.crossover), the reused line jumping to the time of each new event.",
        category: "draw-lines",
        primitives: ["draw.verticalLine"],
    },
    {
        id: "pivot-crosshair",
        label: "Pivot Crosshair",
        description:
            "draw.crossLine — park an orthogonal crosshair (horizontal + vertical strokes through one anchor) on the latest confirmed swing high, recovered via bar.point(-5, …); one reused handle follows each new pivot.",
        category: "draw-lines",
        primitives: ["draw.crossLine"],
    },
    {
        id: "trend-angle-slope",
        label: "Trend Angle Slope",
        description:
            "draw.trendAngle — measure the screen-space slope of the EMA(20) over the last 20 bars, drawing a reused line from bar.point(-20, ema) to bar.point(0, ema) plus an arc and a degree label at the tail.",
        category: "draw-lines",
        primitives: ["draw.trendAngle"],
    },
    {
        id: "sine-wave-cycle",
        label: "Sine Wave Cycle",
        description:
            "draw.sineLine — fit a sine wave over a fixed 40-bar window: baseline at the anchors' midpoint, amplitude half their price span, half-period the time between them (the window low to the window high), re-fit each bar and extended across the viewport.",
        category: "draw-lines",
        primitives: ["draw.sineLine"],
    },
    {
        id: "pivot-polyline",
        label: "Pivot Polyline",
        description:
            "draw.polyline — a CLOSED polyline (the renderer auto-connects the last anchor back to the first) through three data-derived points: a 40-bar low, a 20-bar high, and the current close.",
        category: "draw-lines",
        primitives: ["draw.polyline"],
    },
    {
        id: "swing-path",
        label: "Swing Path",
        description:
            "draw.path — an OPEN path (no wrap-around close, unlike draw.polyline) tracing the close at five fixed bar.point offsets back to the current bar, drawn once 40 bars of history exist.",
        category: "draw-lines",
        primitives: ["draw.path"],
    },
];

export default entries;
