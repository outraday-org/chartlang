// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Demo script catalogue. The first three mirror the Phase-1 examples in
// `examples/scripts/`; "Smoothed RSI Cross" is demo-only and shows one
// indicator's output feeding another (`ta.ema` of `ta.rsi`). "Manual SMA"
// is demo-only and spells the SMA formula out by hand from the price
// series (a bounded `for` loop summing `bar.close[i]` over the window,
// then averaging — the loop index is resolved precisely, so the buffer
// is sized exactly). "Trend
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
// "Fill Between Band" mirrors examples/scripts/fill-between-band.chart.ts and
// shows `draw.fillBetween` — the native filled ribbon between two edges (the
// linefill / fill() equivalent): a fast and slow EMA accumulated into two
// persistent edge arrays and re-emitted as one band every bar.
// "Up Streak" mirrors examples/scripts/up-streak.chart.ts and shows
// `state.series` — a WRITABLE, indexable user series. It counts consecutive
// up-closes, a SELF-REFERENTIAL value (defined in terms of its own prior bar)
// that `bar.close[N]` cannot express, then reads the streak back three bars
// ago to prove the user series is indexable too.
// "Z-Order Layering" mirrors examples/scripts/z-layering.chart.ts and shows
// the presentation-only `z` render-order key: a draw.fillBetween band given
// `z: -1` so it renders BEHIND the price plot (a drawing beneath a plot, which
// the fixed group stack alone forbids), plus an SMA at `z: 1` on top.
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
        // \`bar.close\` is a price series: \`bar.close[0]\` is the current close,
        // \`bar.close[1]\` is one bar ago, and so on. Index it directly — no
        // helper needed. (It still works as a plain number too, so
        // \`bar.close * 2\` and \`ta.sma(bar.close, 5)\` are fine.)
        //
        // Mean of the last 5 closes. \`bar.close\` is a price series, so a
        // bounded \`for\` loop indexes the window directly: chartlang resolves
        // \`bar.close[i]\` over the literal loop bounds, so the buffer is sized
        // to exactly 5 slots (maxLookback 4) with no dynamic-index warning —
        // identical to spelling out \`(bar.close[0] + ... + bar.close[4]) / 5\`.
        // Out-of-range reads are NaN, so this warms up over 4 bars,
        // bar-for-bar identical to ta.sma(close, 5).
        let sum = 0;
        for (let i = 0; i < 5; i++) {
            sum += bar.close[i];
        }
        const manual = sum / 5;

        // Plot the built-in red ta.sma(5) first, then the green manual line
        // last so it renders on top — they coincide bar-for-bar after warmup,
        // so the green manual SMA sits over the red automatic one.
        plot(ta.sma(bar.close, 5), { color: "#ef5350", title: "ta.sma(5)" });
        plot(manual, { color: "#26a69a", title: "Manual SMA(5)" });
    },
});
`;

const TREND_COMPOSITION = `// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";

// Private dep — bound to a local \`const\`, never exported. Mounted as a
// data feed only; its own plots are dropped by the runtime filter.
// Tip: prefix this with \`export\` (\`export const baseTrend = ...\`) to also
// plot its line — exported indicators render; private ones stay data-only.
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

        // Weekly trend computed ON the weekly bars (20 weekly EMA), aligned
        // no-lookahead to the chart. The callback runs on the higher-timeframe
        // clock, so this is a true weekly EMA(20) (~140 days), not 20 main
        // bars of a weekly-stepped series.
        const weeklyTrend = request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 20));
        plot(weeklyTrend, { color: "#ef5350", title: "Weekly EMA(20)" });
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

        // The universal \`opts.offset\` is a presentation display shift, not a
        // value-read: a positive offset renders the line to the right
        // (future) and a negative offset to the left (past), while the
        // numeric series value stays unshifted (alerts and indexing see the
        // value computed at the current bar). The shift lives on the \`ta\`
        // call, since \`plot\` has no offset option.
        plot(ta.sma(bar.close, 20, { offset: 5 }), { color: "#ef5350", title: "SMA(20) +5" });
        plot(ta.sma(bar.close, 20, { offset: -5 }), { color: "#42a5f5", title: "SMA(20) −5" });
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

import { defineIndicator, draw, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Forecast Line",
    apiVersion: 1,
    overlay: true,
    // One projected line, redrawn every bar from the same source line, so a
    // single "lines" slot is the whole drawing budget we need.
    maxDrawings: { lines: 1, labels: 0, boxes: 0, polylines: 0, other: 0 },
    compute({ bar, ta, draw, plot }) {
        // A 20-bar EMA, kept as an indexable series so we can read its value
        // now (\`trend[0]\`) and \`LOOKBACK\` bars ago (\`trend[LOOKBACK]\`).
        const LOOKBACK = 20;
        const PROJECT = 20;
        const trend = ta.ema(bar.close, LOOKBACK);
        plot(trend, { color: "#26a69a", title: "EMA(20)" });

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

const FILL_BETWEEN_BAND = `// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { type WorldPoint, defineIndicator, draw, plot, ta } from "@invinite-org/chartlang-core";

// Two persistent edge arrays, accumulated one { time, price } vertex per bar.
const fastEdge: WorldPoint[] = [];
const slowEdge: WorldPoint[] = [];

export default defineIndicator({
    name: "Fill Between Band",
    apiVersion: 1,
    overlay: true,
    // One ribbon, re-emitted every bar from the same source line, so a single
    // "polylines" slot (fill-between's bucket) is the whole drawing budget.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, ta, plot, draw }) {
        const fast = ta.ema(bar.close, 12);
        const slow = ta.ema(bar.close, 26);

        // Plot the two EMAs so the band's edges are visible on the candles.
        plot(fast, { color: "#3b82f6", title: "EMA(12)" });
        plot(slow, { color: "#9ca3af", title: "EMA(26)" });

        // Grow both edges by one vertex per bar. The fill is the closed polygon
        // fastEdge forward then slowEdge reversed, so the two running EMAs
        // become the top and bottom of a filled ribbon.
        if (Number.isFinite(fast.current) && Number.isFinite(slow.current)) {
            fastEdge.push({ time: bar.time, price: fast.current });
            slowEdge.push({ time: bar.time, price: slow.current });
        }

        // Re-emit the band from this same source line every bar. The runtime
        // keys the callsite by its injected slot id and merges each re-emission
        // into one persistent drawing, so the ribbon extends to the new bar
        // rather than stacking a fresh fill each step.
        if (fastEdge.length >= 2) {
            draw.fillBetween(fastEdge, slowEdge, {
                fill: "#3b82f6",
                fillAlpha: 0.2,
                color: "#3b82f6",
                lineWidth: 1,
            });
        }
    },
});
`;

const ANCHORED_LINE = `// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, state } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Anchored Line",
    apiVersion: 1,
    overlay: true,
    // One line, redrawn every bar from the same source line, so a single
    // "lines" slot is the whole drawing budget we need.
    maxDrawings: { lines: 1, labels: 0, boxes: 0, polylines: 0, other: 0 },
    compute({ bar, state, draw }) {
        // Pin the START anchor at an ABSOLUTE point in time: the first bar's
        // own timestamp and close, captured once into persistent state.* slots
        // (Pine \`var\`). NaN is the "not captured yet" sentinel, so the very
        // first bar — and only that bar — fills the slots. From then on the
        // start anchor is a fixed { time, price } that never moves.
        const startTime = state.float(Number.NaN);
        const startPrice = state.float(Number.NaN);
        if (Number.isNaN(startTime.value)) {
            startTime.value = bar.time;
            // bar.close is a Series VIEW object, not a number — index it ([0])
            // to pin the first bar's close as a finite scalar. Storing the view
            // directly persists a live proxy and the drawing's price anchor
            // fails the runtime's finite-WorldPoint check (dropped as malformed).
            startPrice.value = bar.close[0];
        }

        // Draw a line from that absolute-time start to a BAR-INDEX end. The two
        // anchor styles compose because both resolve to a WorldPoint:
        //   • start — a literal { time, price } built from the remembered
        //     absolute timestamp (the "start at X point in time" case).
        //   • end   — bar.point(0, …), the offset-anchored current bar (the
        //     "start at X bar index" case; offset 0 == the live bar's time).
        // Re-emitting from this same source line every bar reuses one drawing
        // handle, so the line's tail tracks the latest bar while its head stays
        // pinned to the first bar's time.
        draw.line(
            { time: startTime.value, price: startPrice.value },
            bar.point(0, bar.close),
            { color: "#3b82f6", lineWidth: 2 },
        );
    },
});
`;

const UP_STREAK = `// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, state } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Up Streak",
    apiVersion: 1,
    overlay: false,
    compute({ bar, state, plot }) {
        // Consecutive up-closes. This is the case that genuinely NEEDS a
        // writable series: the value is SELF-REFERENTIAL — it is defined in
        // terms of its OWN value one bar ago — so it cannot be read off
        // \`bar.close[N]\` the way a plain price lookback can (that is the
        // directly-indexable-bar-series / Manual SMA case). \`state.series\`
        // both STORES this bar's streak and lets us look it back N bars later.
        const streak = state.series(0);
        const up = bar.close.current > bar.close[1];

        // \`streak[1]\` is the committed streak one bar ago. On the very first
        // bar it is NaN (no committed history yet), so the warmup guard treats
        // it as 0 before incrementing; a down-close resets the streak to 0.
        streak.value = up ? (Number.isFinite(streak[1]) ? streak[1] : 0) + 1 : 0;

        plot(streak.current, { title: "Up streak" });
        // The history index proves the writable series is also indexable: this
        // is the streak as it stood three bars ago (NaN during warmup).
        plot(streak[3], { title: "Streak 3 bars ago" });
    },
});
`;

const Z_LAYERING = `// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { type WorldPoint, defineIndicator, draw, plot, ta } from "@invinite-org/chartlang-core";

// Two persistent edge arrays, accumulated one { time, price } vertex per bar.
const fastEdge: WorldPoint[] = [];
const slowEdge: WorldPoint[] = [];

export default defineIndicator({
    name: "Z-Order Layering",
    apiVersion: 1,
    overlay: true,
    // One ribbon, re-emitted every bar from the same source line, so a single
    // "polylines" slot (fill-between's bucket) is the whole drawing budget.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, ta, plot, draw }) {
        const fast = ta.ema(bar.close, 12);
        const slow = ta.ema(bar.close, 26);

        // Grow both edges by one vertex per bar — the fast EMA is the band's
        // top, the slow EMA its bottom.
        if (Number.isFinite(fast.current) && Number.isFinite(slow.current)) {
            fastEdge.push({ time: bar.time, price: fast.current });
            slowEdge.push({ time: bar.time, price: slow.current });
        }

        // The headline: z: -1 pulls the fill BENEATH the price plot. A draw.*
        // mark renders above plots by default (its band sits higher), so a
        // negative z is the only way to put a drawing under a plot — the fixed
        // group stack alone forbids it.
        if (fastEdge.length >= 2) {
            draw.fillBetween(fastEdge, slowEdge, {
                fill: "#3b82f6",
                fillAlpha: 0.2,
                color: "#3b82f6",
                lineWidth: 1,
                z: -1,
            });
        }

        // Declared FIRST, so the default "last plot wins" stack would render
        // the SMA at the BOTTOM. z: 1 overrides that order and lifts it back
        // above the price — that inversion is the whole point: if the SMA were
        // plotted last instead, it would sit on top by default and z would be
        // doing nothing. Emission order is unchanged by z (presentation only).
        plot(ta.sma(bar.close, 20), { color: "#ef5350", title: "SMA on top", z: 1 });

        // Declared LAST (default z = 0). The "last plot wins" rule would put it
        // on top, but the SMA's z: 1 keeps it below — while its own z = 0 still
        // holds it above the z: -1 band.
        plot(bar.close, { color: "#1e293b", title: "Price" });
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
            "Define an SMA by hand from the price series: a bounded for loop sums bar.close[i] over the window (the loop index is sized precisely), averages the last 5 closes, and overlays ta.sma(5).",
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
            "Multi-timeframe: a current-timeframe EMA(20) overlaid with a true weekly EMA(20) computed ON the weekly bars via the request.security({ interval: \"1W\" }, (bar) => ta.ema(bar.close, 20)) expression form — a smooth, lagged trend, not 20 daily bars of a weekly-stepped series.",
        source: HTF_TREND_FILTER,
    },
    {
        id: "sma-offset",
        label: "SMA Offset",
        description:
            "Three SMA(20) lines: one unshifted plus a +5 copy displaced right and a −5 copy displaced left via the universal ta offset option — a presentation-only display shift (the values stay unshifted).",
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
    {
        id: "fill-between-band",
        label: "Fill between series (band)",
        description:
            "A filled ribbon between two EMAs via draw.fillBetween — the native linefill / fill() equivalent.",
        source: FILL_BETWEEN_BAND,
    },
    {
        id: "anchored-line",
        label: "Anchored Line",
        description:
            "One draw.line composing both X-axis anchor styles: an absolute-time start (the first bar's time and close, pinned in state.* slots) drawn to a bar-index end via bar.point(0, …), so the head stays fixed in time while the tail tracks the current bar.",
        source: ANCHORED_LINE,
    },
    {
        id: "up-streak",
        label: "Up Streak",
        description:
            "state.series — a writable, indexable user series. Counts consecutive up-closes: the history of a value you compute yourself (here a self-referential streak defined from its own prior bar), which bar.close[N] can't express, then reads it back three bars ago.",
        source: UP_STREAK,
    },
    {
        id: "z-layering",
        label: "Z-Order Layering",
        description:
            "Use the presentation-only z option to cross render bands: a draw.fillBetween band given z: -1 renders BEHIND the price plot (a drawing beneath a plot, which the default group stack forbids), while an SMA at z: 1 sits on top.",
        source: Z_LAYERING,
    },
];
