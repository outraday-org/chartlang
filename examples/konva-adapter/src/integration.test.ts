// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import {
    type WorkerBootScope,
    type WorkerLike,
    createWorkerBoot,
} from "@invinite-org/chartlang-host-worker";
import { describe, expect, it } from "vitest";

import { createKonvaAdapter, feedCandleEvent } from "./createKonvaAdapter.js";
import type { RecordedNode, RecordedNodeType } from "./testing.js";
import { MockKonva, hashKonvaScene } from "./testing.js";

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
    name: "EMA Cross (konva integration fixture)",
    inputs: {},
    capabilities: ["indicators"],
    requestedIntervals: [],
    userPickableInterval: false,
    seriesCapacities: { ohlcv: 64 },
    maxLookback: 26,
};

const FIRST_TIME = START_TIME;
const LAST_TIME = START_TIME + 39 * MS_PER_DAY;

// Hand-crafted compiled-bundle source equivalent to an EMA-cross + drawings
// script: calls the runtime's slot-aware `ctx.ta.*` / `ctx.plot` /
// `ctx.alert` / `ctx.draw.*` directly so the bundle has no static imports
// (the worker's data-URL import path cannot resolve workspace specifiers).
// The drawings emit once, on the last history bar, so they ride a
// fully-warmed bar window — line → Konva Line, rectangle → closed Line,
// fib → multiple Lines + Texts, marker → Text.
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

// Walk the leaf-node types under a recorded layer (skipping containers).
function leafTypes(layer: RecordedNode): RecordedNodeType[] {
    const out: RecordedNodeType[] = [];
    const walk = (node: RecordedNode): void => {
        if (node.type !== "Stage" && node.type !== "Layer" && node.type !== "Group") {
            out.push(node.type);
        }
        for (const child of node.children) walk(child);
    };
    for (const child of layer.children) walk(child);
    return out;
}

describe("konva adapter integration (worker host)", () => {
    it("drives an EMA-cross + drawings bundle through the worker shim into Konva nodes", async () => {
        const { worker, scope } = pair();
        createWorkerBoot(scope);
        const konva = new MockKonva();
        const adapter = createKonvaAdapter({
            konva,
            stage: { width: 800, height: 400 },
            candleSource: mockCandleSource(HISTORY_BARS, { interval: "1D", mode: "stream" }),
            workerLike: worker,
            resolveInputs: () => ({}),
        });

        await adapter.host.load({
            moduleSource: EMA_CROSS_MODULE_SOURCE,
            manifest: EMA_CROSS_MANIFEST,
        });

        // Drive the candle source through the worker host, mirroring each
        // event into the adapter's bar window (so candles + the drawing
        // viewport scale repaint) and draining plots + drawings into
        // `onEmissions` between events. Konva has no `runRendererLoop`, so
        // the loop lives here.
        for await (const event of adapter.candles({ interval: "1D" })) {
            feedCandleEvent(adapter, event);
            await adapter.host.push(event);
            const emissions = await adapter.host.drain();
            adapter.onEmissions(emissions);
        }

        // roots: [Stage, seriesLayer, drawingsLayer, … rebuilt groups].
        const seriesLayer = konva.roots[1];
        const drawingsLayer = konva.roots[2];

        // The series layer carries candles (Line wick + Rect body per bar)
        // plus the two EMA Line series.
        const seriesLeaves = leafTypes(seriesLayer);
        expect(seriesLeaves.filter((t) => t === "Rect").length).toBe(HISTORY_BARS.length);
        expect(seriesLeaves.filter((t) => t === "Line").length).toBeGreaterThanOrEqual(
            HISTORY_BARS.length + 2,
        );

        // The drawings layer carries: line → 1 Line; rectangle → 1 closed
        // Line; fib-retracement → multiple Lines (level rails) + Texts
        // (labels); marker → 1 Text. So Lines ≥ 3 and at least one Text.
        const drawLeaves = leafTypes(drawingsLayer);
        expect(drawLeaves.filter((t) => t === "Line").length).toBeGreaterThanOrEqual(3);
        expect(drawLeaves.filter((t) => t === "Text").length).toBeGreaterThanOrEqual(1);

        // Pinned hash — re-snap after a deliberate mapping change by reading
        // the new value off this assertion's failure message. `hashKonvaScene`
        // rounds finite floats to 4 dp, so microscopic drift does not re-hash.
        expect(hashKonvaScene(konva)).toBe(PINNED_HASH);

        adapter.dispose();
    });
});

// Pinned by the integration test; update only when a deliberate change
// re-shapes the emitted node tree.
const PINNED_HASH = "b87e26f828127b926faf1f90379f0600870ca3dcb88c279184f7233fd8542a95";
