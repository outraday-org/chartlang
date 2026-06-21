// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
import type { ScriptManifest } from "@invinite-org/chartlang-core";
import type { Bar } from "@invinite-org/chartlang-core";
import {
    type WorkerBootScope,
    type WorkerLike,
    createWorkerBoot,
} from "@invinite-org/chartlang-host-worker";
import type {
    CandlestickSeriesOption,
    EChartsOption,
    LineSeriesOption,
    SeriesOption,
} from "echarts/types/dist/echarts";
import { describe, expect, it } from "vitest";

import { createEChartsAdapter, runEChartsLoop } from "./createEChartsAdapter.js";
import { MockECharts, hashOptionLog } from "./testing.js";

// Pair a `MessageChannel`-backed `WorkerLike` with a `WorkerBootScope`,
// cribbed from `@invinite-org/chartlang-host-worker`'s integration test.
function pair(): { worker: WorkerLike; scope: WorkerBootScope } {
    const ch = new MessageChannel();
    ch.port1.start();
    ch.port2.start();
    const worker: WorkerLike = {
        addEventListener(type, listener) {
            if (type !== "message") return;
            ch.port1.addEventListener("message", (ev) => {
                listener(ev as MessageEvent<unknown>);
            });
        },
        postMessage(msg) {
            ch.port1.postMessage(msg);
        },
        terminate() {
            ch.port1.close();
            ch.port2.close();
        },
    };
    const scope: WorkerBootScope = {
        addEventListener(_type, listener) {
            ch.port2.addEventListener("message", (ev) => {
                void listener(ev as MessageEvent<never>);
            });
        },
        postMessage(msg) {
            ch.port2.postMessage(msg);
        },
    };
    return { worker, scope };
}

const MS_PER_DAY = 86_400_000;
const START_TIME = 1_700_000_000_000;

function bar(i: number, close: number): Bar {
    const open = close - 0.5;
    const high = close + 1;
    const low = close - 1;
    return {
        time: START_TIME + i * MS_PER_DAY,
        open,
        high,
        low,
        close,
        volume: 1_000 + i,
        symbol: "EMA-X",
        interval: "1D",
        hl2: (high + low) / 2,
        hlc3: (high + low + close) / 3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
    };
}

// A downtrend (bars 0-19) settles EMA(5) below EMA(12) post-warmup, then an
// uptrend (bars 20-39) accelerates EMA(5) up THROUGH EMA(12) — a clean
// post-warmup crossover so the script's `alert` fires.
const HISTORY_BARS: ReadonlyArray<Bar> = Array.from({ length: 40 }, (_, i) => {
    const close = i < 20 ? 120 - i : 100 + (i - 20);
    return bar(i, close);
});

const EMA_CROSS_MANIFEST: ScriptManifest = {
    apiVersion: 1,
    kind: "indicator",
    name: "EMA Cross (echarts integration fixture)",
    inputs: {},
    capabilities: ["indicators"],
    requestedIntervals: [],
    userPickableInterval: false,
    seriesCapacities: { ohlcv: 64 },
    maxLookback: 26,
};

// Hand-crafted compiled-bundle source equivalent to an EMA-cross script that
// also emits a representative spread of drawings: a `line`, a `rectangle`
// (→ closed polygon), a `fibRetracement` (→ multiple polylines + texts), and a
// text-bearing `marker` (→ a text graphic). Calls the runtime's slot-aware
// `ctx.ta.*` / `ctx.plot` / `ctx.alert` / `ctx.draw.*` directly so the bundle
// has no static imports (the worker's data-URL import path cannot resolve
// workspace specifiers). The drawings emit once, on the last history bar, so
// they ride a fully-warmed bar window.
const FIRST_TIME = START_TIME;
const LAST_TIME = START_TIME + 39 * MS_PER_DAY;
const EMA_CROSS_MODULE_SOURCE = `
const FIRST_TIME = ${FIRST_TIME};
const LAST_TIME = ${LAST_TIME};
export default {
    manifest: ${JSON.stringify(EMA_CROSS_MANIFEST)},
    compute: (ctx) => {
        const fast = ctx.ta.ema("ema.chart.ts:1:1#0", ctx.bar.close, 5);
        const slow = ctx.ta.ema("ema.chart.ts:2:1#0", ctx.bar.close, 12);
        ctx.plot("ema.chart.ts:3:1#0", fast, { color: "#26a69a", title: "EMA(5)" });
        ctx.plot("ema.chart.ts:4:1#0", slow, { color: "#ef5350", title: "EMA(12)" });
        if (ctx.ta.crossover("ema.chart.ts:5:1#0", fast, slow).current) {
            ctx.alert("ema.chart.ts:6:1#0", "cross up", { severity: "info" });
        }
        if (ctx.bar.time === LAST_TIME) {
            ctx.draw.line(
                "ema.chart.ts:7:1#0",
                { time: FIRST_TIME, price: 100 },
                { time: LAST_TIME, price: 120 },
                { color: "#3b82f6" },
            );
            ctx.draw.rectangle(
                "ema.chart.ts:8:1#0",
                { time: FIRST_TIME, price: 105 },
                { time: LAST_TIME, price: 115 },
                { color: "#f59e0b" },
            );
            ctx.draw.fibRetracement(
                "ema.chart.ts:9:1#0",
                { time: FIRST_TIME, price: 100 },
                { time: LAST_TIME, price: 130 },
                { showLabels: true },
            );
            ctx.draw.marker(
                "ema.chart.ts:10:1#0",
                { time: LAST_TIME, price: 110 },
                { text: "M" },
            );
        }
    },
};
`;

function lastOption(chart: MockECharts): EChartsOption {
    const option = chart.lastOption();
    if (option === undefined) throw new Error("no setOption recorded");
    return option;
}

function seriesByName(option: EChartsOption, name: string): SeriesOption {
    const series = option.series;
    if (!Array.isArray(series)) throw new Error("expected a series array");
    const found = series.find((s) => s.name === name);
    if (found === undefined) throw new Error(`series ${name} not found`);
    return found;
}

describe("echarts adapter integration (worker host)", () => {
    it("drives an EMA-cross bundle through the worker shim into native ECharts series", async () => {
        const { worker, scope } = pair();
        createWorkerBoot(scope);
        const chart = new MockECharts();
        const alerts: unknown[] = [];
        const adapter = createEChartsAdapter({
            echartsFactory: () => chart,
            candleSource: mockCandleSource(HISTORY_BARS, { interval: "1D", mode: "stream" }),
            workerLike: worker,
            resolveInputs: () => ({}),
            onAlert: (a) => alerts.push(a),
        });

        await adapter.host.load({
            moduleSource: EMA_CROSS_MODULE_SOURCE,
            manifest: EMA_CROSS_MANIFEST,
        });
        await runEChartsLoop(adapter);

        const option = lastOption(chart);
        const candles = seriesByName(option, "candles") as CandlestickSeriesOption;
        expect(candles.type).toBe("candlestick");
        expect(candles.data?.length).toBe(HISTORY_BARS.length);

        const fast = seriesByName(option, "overlay|ema.chart.ts:3:1#0") as LineSeriesOption;
        const slow = seriesByName(option, "overlay|ema.chart.ts:4:1#0") as LineSeriesOption;
        expect(fast.type).toBe("line");
        expect(slow.type).toBe("line");
        // Both EMAs warm up and carry finite values by the last bar.
        expect(fast.data?.at(-1)).not.toBe("-");
        expect(slow.data?.at(-1)).not.toBe("-");
        // The fixture's trend reversal at bar 20 crosses EMA(5) up through
        // EMA(12), so at least one alert fires and is forwarded to `onAlert`.
        expect(alerts.length).toBeGreaterThanOrEqual(1);

        // Drawings render as ECharts `graphic` elements (Task 10). The final
        // frame carries the line, the rectangle (closed polygon), the fib
        // levels (polylines + texts), and the marker (a text graphic).
        const graphic = option.graphic;
        if (!Array.isArray(graphic)) throw new Error("expected a graphic array");
        const types = graphic.map((g) => g?.type);
        // Open line → polyline; rectangle → polygon; fib level lines →
        // polylines; fib labels + marker → text.
        expect(types).toContain("polyline");
        expect(types).toContain("polygon");
        expect(types).toContain("text");
        // The text-bearing marker contributes a `text` graphic whose body is
        // the marker label.
        const markerText = graphic.find((g) => g?.type === "text" && g.style.text === "M");
        expect(markerText).toBeDefined();

        // Pinned hash — re-snap after a deliberate mapping change by reading
        // the new value off this assertion's failure message.
        expect(hashOptionLog(chart.calls)).toBe(PINNED_HASH);

        adapter.dispose();
    });
});

// Pinned by the integration test; update only when a deliberate change
// re-shapes the emitted option tree. `hashOptionLog` rounds finite floats to
// 4 dp and sorts object keys, so microscopic drift does not re-hash.
const PINNED_HASH = "eb4e50e8d985932a125b3addad51b0059d6b0ebe57474dbe2b50fd100ef92d0a";
