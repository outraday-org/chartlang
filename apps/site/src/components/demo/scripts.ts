// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Demo script catalogue. The first three mirror the Phase-1 examples in
// `examples/scripts/`; "Smoothed RSI Cross" is demo-only and shows one
// indicator's output feeding another (`ta.ema` of `ta.rsi`). "Manual SMA"
// is demo-only and spells the SMA formula out by hand from the price
// series (length-1 MA as an identity to expose `bar.close` as an
// indexable `Series<number>`, then literal-lookback averaging). "Trend
// Composition" demonstrates Phase-7 indicator composition — one file
// with a private dep, a named export, and a default-export consumer.
// "HTF Trend Filter" mirrors examples/scripts/htf-trend-filter.chart.ts
// and demonstrates multi-timeframe request.security — a weekly EMA pulled
// over the daily demo candles. "SMA Offset" mirrors
// examples/scripts/sma-offset.chart.ts and demonstrates the universal
// `ta` offset option — two SMA(20) lines, one shifted back 5 bars.
// "Pivot High Ray" mirrors examples/scripts/pivot-high-ray.chart.ts and
// shows persistent `state.*` slots (Pine `var`) plus `bar.point`: it
// remembers the most recent swing high's price AND time (the time is
// recovered with `bar.point(-5, …)`, the offset-anchored historical
// timestamp), then draws a single horizontal `draw.horizontalRay` from
// it, reusing one drawing handle so the ray follows each new pivot.
// "Forecast Line" mirrors examples/scripts/forecast-line.chart.ts and shows
// the POSITIVE (future) `bar.point(+N, …)` path: it measures the recent
// EMA(20) slope and projects a dotted line 20 bars into the future, so the
// forward offset resolves to an extrapolated future timestamp to the right
// of the last candle (negative/zero offsets are covered by Pivot High Ray).
// Inlined as strings so the demo does not need a build-time file read.

export type DemoScript = Readonly<{
    id: string;
    label: string;
    description: string;
    source: string;
}>;

const EMA_CROSS = `// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { alert, defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "EMA Cross",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot, alert }) {
        const fast = ta.ema(bar.close, 12);
        const slow = ta.ema(bar.close, 26);

        plot(fast, { color: "#26a69a", title: "EMA(12)" });
        plot(slow, { color: "#ef5350", title: "EMA(26)" });

        if (ta.crossover(fast, slow).current) {
            alert("EMA(12) crossed above EMA(26)", { severity: "info" });
        }
        if (ta.crossunder(fast, slow).current) {
            alert("EMA(12) crossed below EMA(26)", { severity: "warning" });
        }
    },
});
`;

const BOLLINGER_BANDS = `// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Bollinger Bands",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const bands = ta.bb(bar.close, 20, { multiplier: 2 });
        plot(bands.upper, { color: "#cccccc", title: "BB Upper", lineWidth: 1 });
        plot(bands.middle, { color: "#90caf9", title: "BB Middle", lineWidth: 2 });
        plot(bands.lower, { color: "#cccccc", title: "BB Lower", lineWidth: 1 });
    },
});
`;

const RSI_DIVERGENCE_ALERT = `// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { alert, defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "RSI Divergence Alert",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline, alert }) {
        const rsi = ta.rsi(bar.close, 14);
        plot(rsi, { color: "#9c27b0", title: "RSI(14)" });

        hline(70, { color: "#ef5350", lineStyle: "dashed", title: "Overbought" });
        hline(30, { color: "#26a69a", lineStyle: "dashed", title: "Oversold" });

        if (ta.crossunder(rsi, 70).current) {
            alert("RSI dropped below 70 (overbought exit)", { severity: "warning" });
        }
        if (ta.crossover(rsi, 30).current) {
            alert("RSI rose above 30 (oversold exit)", { severity: "info" });
        }
    },
});
`;

const SMOOTHED_RSI_CROSS = `// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { alert, defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Smoothed RSI Cross",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, alert }) {
        // One indicator feeding another: the per-bar RSI(14) value is
        // the input series of an EMA(9).
        const rsi = ta.rsi(bar.close, 14);
        const smoothed = ta.ema(rsi, 9);

        plot(rsi, { color: "#9c27b0", title: "RSI(14)" });
        plot(smoothed, { color: "#ffb74d", title: "EMA(9) of RSI" });

        if (ta.crossover(rsi, smoothed).current) {
            alert("RSI crossed above its EMA(9)", { severity: "info" });
        }
        if (ta.crossunder(rsi, smoothed).current) {
            alert("RSI crossed below its EMA(9)", { severity: "warning" });
        }
    },
});
`;

const EXPLICIT_PANE_ROUTING = `// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Explicit Pane Routing",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot, hline }) {
        // Overlay (price) pane: a fast/slow EMA pair on the candles.
        plot(ta.ema(bar.close, 20), { color: "#26a69a", title: "EMA(20)" });
        plot(ta.ema(bar.close, 50), { color: "#ef5350", title: "EMA(50)" });

        // Explicit subpane: a bounded RSI(14) oscillator on its own
        // 0-100 y-scale, with 70/30 overbought/oversold bands routed
        // into the same "rsi" pane via \`hline(..., { pane })\`.
        plot(ta.rsi(bar.close, 14), { color: "#9c27b0", title: "RSI(14)", pane: "rsi" });
        hline(70, { color: "#ef5350", lineStyle: "dashed", title: "Overbought", pane: "rsi" });
        hline(30, { color: "#26a69a", lineStyle: "dashed", title: "Oversold", pane: "rsi" });
    },
});
`;

const MANUAL_SMA = `// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Manual SMA",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        // An SMA is just the mean of the last N closes. chartlang ships a
        // built-in \`ta.sma\`, but you can also spell the formula out by hand
        // straight from the price series.
        //
        // \`bar.close\` is the *scalar* close at the current bar, not a series,
        // so it cannot be indexed directly. Routing it through a length-1
        // moving average republishes it as an indexable \`Series<number>\`
        // whose literal lookbacks (\`src[1]\`, \`src[2]\`, ...) read prior bars.
        // \`ta.ema(_, 1)\` is an exact identity (alpha = 1, zero warmup).
        const src = ta.ema(bar.close, 1);

        // Mean of the last 5 closes: (src[0] + ... + src[4]) / 5. Series
        // indices must be literal integers, so the window is unrolled.
        // Out-of-range reads are NaN, so this warms up over 4 bars —
        // bar-for-bar identical to ta.sma(close, 5).
        const manual = (src[0] + src[1] + src[2] + src[3] + src[4]) / 5;

        plot(manual, { color: "#26a69a", title: "Manual SMA(5)" });
        plot(ta.sma(bar.close, 5), { color: "#ef5350", title: "ta.sma(5)" });
    },
});
`;

const TREND_COMPOSITION = `// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";

// Private dep — bound to a local \`const\`, never exported. Mounted as a
// data feed only; its own plots are dropped by the runtime filter.
const baseTrend = defineIndicator({
    name: "Base Trend",
    apiVersion: 1,
    overlay: true,
    inputs: { length: input.int(20, { min: 2, max: 250 }) },
    compute({ bar, ta, inputs, plot }) {
        plot(ta.ema(bar.close, inputs.length as number), { title: "line" });
    },
});

// Drawn sibling — named export. Renders under the \`export:slowTrend/\`
// slot-id prefix, separate from the default export's slots.
export const slowTrend = defineIndicator({
    name: "Slow Trend",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.ema(bar.close, 50), { color: "#9ca3af", title: "line" });
    },
});

// Drawn primary — default export. Consumes both deps and marks crossovers.
export default defineIndicator({
    name: "Trend Composition",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const fast = baseTrend.output("line");
        const slow = slowTrend.output("line");
        if (ta.crossover(fast, slow).current) {
            plot(bar.low, {
                color: "#22c55e",
                title: "Cross",
                style: { kind: "shape", shape: "triangle-up", size: 10, location: "below" },
            });
        }
    },
});
`;

const HTF_TREND_FILTER = `// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, request, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "HTF Trend Filter",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot, request }) {
        // Current-timeframe trend.
        const fast = ta.ema(bar.close, 20);
        plot(fast, { color: "#26a69a", title: "EMA(20)" });

        // Higher-timeframe trend pulled from weekly candles via
        // request.security. The interval must be a compile-time literal;
        // alignment is no-lookahead (weekly value holds until the next
        // weekly close).
        const weekly = request.security({ interval: "1W" });
        const weeklyTrend = ta.ema(weekly.close, 10);
        plot(weeklyTrend, { color: "#ef5350", title: "Weekly EMA(10)" });
    },
});
`;

const SMA_OFFSET = `// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "SMA Offset",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const sma = ta.sma(bar.close, 20);
        plot(sma, { color: "#26a69a", title: "SMA(20)" });

        // The universal \`opts.offset\` shifts the output forward: with
        // \`{ offset: 5 }\`, the returned series' \`.current\` reads the SMA value
        // from 5 bars ago, displacing the line to the right. The shift lives on
        // the \`ta\` call, since \`plot\` has no offset option. Past values of the
        // unshifted series remain readable by indexing, e.g. \`sma[5]\`.
        const smaShifted = ta.sma(bar.close, 20, { offset: 5 });
        plot(smaShifted, { color: "#ef5350", title: "SMA(20) offset 5" });
    },
});
`;

const PIVOT_HIGH_RAY = `// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Pivot High Ray",
    apiVersion: 1,
    overlay: true,
    // One ray, reused across every bar (see below), so a single "lines"
    // slot is the whole drawing budget we need.
    maxDrawings: { lines: 1, labels: 0, boxes: 0, polylines: 0, other: 0 },
    compute({ bar, ta, state, draw }) {
        // Swing-high detection: a bar whose high tops the 5 bars on each
        // side. A pivot can only be *confirmed* once the 5 bars to its
        // right exist, so \`pivots.high.current\` turns non-NaN 5 bars late
        // and reports the high from 5 bars back.
        const pivots = ta.pivotsHighLow({ leftLength: 5, rightLength: 5 });

        // \`state.*\` slots persist across bars (Pine \`var\`). Remember the
        // latest pivot high's price AND time so we can keep drawing from
        // it on every later bar — this is the "track the last high" part.
        const lastTime = state.float(Number.NaN);
        const lastPrice = state.float(Number.NaN);

        if (!Number.isNaN(pivots.high.current)) {
            // The confirmed pivot sits 5 bars back. \`bar.point(-5, …)\`
            // resolves that offset to the real historical timestamp from
            // the runtime's time buffer — no hand-rolled time series. The
            // offset literal must stay in sync with \`rightLength\` above (a
            // negative integer literal is what sizes the lookback buffer).
            const anchor = bar.point(-5, pivots.high.current);
            lastTime.value = anchor.time;
            lastPrice.value = anchor.price;
        }

        // Once a high is known, draw a horizontal ray from it to the right
        // edge. Calling \`draw.horizontalRay\` every bar from this same line
        // of source reuses one drawing handle — the runtime emits an
        // \`update\`, not a new ray — so the single line simply jumps to each
        // new swing high as it is confirmed.
        if (!Number.isNaN(lastPrice.value)) {
            draw.horizontalRay(
                { time: lastTime.value, price: lastPrice.value },
                { color: "#ef5350", lineWidth: 2, lineStyle: "dashed" },
            );
        }
    },
});
`;

const FORECAST_LINE = `// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Forecast Line",
    apiVersion: 1,
    overlay: true,
    // One projected line, redrawn every bar from the same source line, so a
    // single "lines" slot is the whole drawing budget we need.
    maxDrawings: { lines: 1, labels: 0, boxes: 0, polylines: 0, other: 0 },
    compute({ bar, ta, draw }) {
        // A 20-bar EMA, kept as an indexable series so we can read its value
        // now (\`trend[0]\`) and \`LOOKBACK\` bars ago (\`trend[LOOKBACK]\`).
        const LOOKBACK = 20;
        const PROJECT = 20;
        const trend = ta.ema(bar.close, LOOKBACK);

        // Per-bar slope of the recent trend, in price units per bar.
        const slope = (trend[0] - trend[LOOKBACK]) / LOOKBACK;

        // Project that slope \`PROJECT\` bars into the future. \`bar.point(0, …)\`
        // anchors the line's start at the current bar; \`bar.point(+PROJECT, …)\`
        // resolves the FORWARD offset to an extrapolated future timestamp
        // (\`lastTime + PROJECT * spacing\`, spacing = median retained-bar delta).
        // A positive offset is what makes the line reach to the RIGHT of the
        // last candle — the negative/zero offsets are covered by pivot-high-ray.
        if (Number.isFinite(slope)) {
            const start = bar.point(0, trend[0]);
            const end = bar.point(PROJECT, trend[0] + slope * PROJECT);
            draw.line(start, end, { color: "#ab47bc", lineWidth: 2, lineStyle: "dotted" });
        }
    },
});
`;

export const DEMO_SCRIPTS: ReadonlyArray<DemoScript> = [
    {
        id: "ema-cross",
        label: "EMA Cross",
        description:
            "A fast/slow EMA pair on the candles, firing alerts when the fast EMA crosses the slow one.",
        source: EMA_CROSS,
    },
    {
        id: "bollinger-bands",
        label: "Bollinger Bands",
        description:
            "Bollinger Bands via ta.bb — upper, middle, and lower bands plotted over price.",
        source: BOLLINGER_BANDS,
    },
    {
        id: "rsi-divergence-alert",
        label: "RSI Divergence Alert",
        description:
            "RSI(14) in its own pane with 70/30 overbought/oversold guides and alerts on each crossing.",
        source: RSI_DIVERGENCE_ALERT,
    },
    {
        id: "smoothed-rsi-cross",
        label: "Smoothed RSI Cross",
        description:
            "Indicator composition: one indicator feeding another, with RSI(14) smoothed by an EMA(9) of its own output.",
        source: SMOOTHED_RSI_CROSS,
    },
    {
        id: "explicit-pane-routing",
        label: "Explicit Pane Routing",
        description:
            "An EMA pair on the price pane plus an RSI oscillator routed to its own subpane via explicit pane ids.",
        source: EXPLICIT_PANE_ROUTING,
    },
    {
        id: "manual-sma",
        label: "Manual SMA",
        description:
            "Define an SMA by hand from the price series: expose bar.close as an indexable Series via a length-1 MA, average the last 5 literal lookbacks, and watch it overlay ta.sma(5) exactly.",
        source: MANUAL_SMA,
    },
    {
        id: "trend-composition",
        label: "Trend Composition",
        description:
            "Phase-7 indicator composition: a private dependency, a named export, and a default consumer that marks crossovers.",
        source: TREND_COMPOSITION,
    },
    {
        id: "htf-trend-filter",
        label: "HTF Trend Filter",
        description:
            "Multi-timeframe: a current-timeframe EMA(20) overlaid with a weekly EMA(10) pulled from request.security({ interval: \"1W\" }) over daily candles.",
        source: HTF_TREND_FILTER,
    },
    {
        id: "sma-offset",
        label: "SMA Offset",
        description:
            "Two SMA(20) lines, one shifted back 5 bars via the universal ta offset option, showing series displacement.",
        source: SMA_OFFSET,
    },
    {
        id: "pivot-high-ray",
        label: "Pivot High Ray",
        description:
            "Track the latest swing high's price and time in persistent state.* slots, then draw one horizontal ray from it that follows each new pivot via a reused draw.horizontalRay handle.",
        source: PIVOT_HIGH_RAY,
    },
    {
        id: "forecast-line",
        label: "Forecast Line",
        description:
            "Project the recent EMA(20) slope 20 bars into the future with bar.point(+N, …), drawing a dotted line to the right of the last candle — the positive (future) offset path.",
        source: FORECAST_LINE,
    },
];
