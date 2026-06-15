// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Demo script catalogue. The first three mirror the Phase-1 examples in
// `examples/scripts/`; "Smoothed RSI Cross" is demo-only and shows one
// indicator's output feeding another (`ta.ema` of `ta.rsi`). "Trend
// Composition" demonstrates Phase-7 indicator composition — one file
// with a private dep, a named export, and a default-export consumer.
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
        id: "trend-composition",
        label: "Trend Composition",
        description:
            "Phase-7 indicator composition: a private dependency, a named export, and a default consumer that marks crossovers.",
        source: TREND_COMPOSITION,
    },
];
