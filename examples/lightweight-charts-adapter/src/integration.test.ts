// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
import type { DrawingEmission, RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";
import { MockCanvasContext, hashCallLog } from "@invinite-org/chartlang-adapter-kit/canvas";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import {
    type ScriptHost,
    type WorkerBootScope,
    type WorkerLike,
    createWorkerBoot,
    createWorkerHost,
} from "@invinite-org/chartlang-host-worker";
import { describe, expect, it } from "vitest";

import { LWC_CAPABILITIES, LWC_SYM_INFO } from "./capabilities.js";
import {
    createLightweightChartsAdapter,
    runRendererLoop,
} from "./createLightweightChartsAdapter.js";
import { DrawingPrimitive, type PaintScope } from "./drawingPrimitive.js";
import { MockLwcApi } from "./testing.js";

// MessageChannel-backed worker pair (cribbed from the canvas2d integration
// test / host-worker's own integration harness).
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
        symbol: "DRAW-X",
        interval: "1D",
        hl2: (high + low) / 2,
        hlc3: (high + low + close) / 3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
    };
}

// 40 trending bars so the EMA(10) warms and the swing anchors are finite.
const BARS: ReadonlyArray<Bar> = Array.from({ length: 40 }, (_, i) => bar(i, 100 + i * 0.5));

const MANIFEST: ScriptManifest = {
    apiVersion: 1,
    kind: "indicator",
    name: "draw integration fixture",
    inputs: {},
    capabilities: ["indicators"],
    requestedIntervals: [],
    userPickableInterval: false,
    seriesCapacities: { ohlcv: 64 },
    maxLookback: 10,
};

// An EMA(10) line PLUS three drawings (line / rectangle / fibRetracement),
// each a single reused handle anchored on the running bar window. Calls the
// runtime's slot-aware impls directly so the bundle has no static imports
// (the worker's `data:` import cannot resolve workspace specifiers).
const MODULE_SOURCE = `
export default {
    manifest: ${JSON.stringify(MANIFEST)},
    compute: (ctx) => {
        const ema = ctx.ta.ema("draw.chart.ts:5:20#0", ctx.bar.close, 10);
        ctx.plot("draw.chart.ts:6:9#0", ema, { color: "#26a69a", title: "EMA(10)" });
        const lo = ctx.bar.point(0, ctx.bar.low);
        const hi = ctx.bar.point(0, ctx.bar.high);
        ctx.draw.line("draw.chart.ts:9:13#0", lo, hi, { color: "#3b82f6", lineWidth: 2 });
        ctx.draw.rectangle("draw.chart.ts:10:13#0", lo, hi, {
            stroke: "#ef5350",
            fill: "#fee2e2",
            fillAlpha: 0.3,
        });
        ctx.draw.fibRetracement("draw.chart.ts:11:13#0", lo, hi, { showLabels: true });
    },
};
`;

function captureHost(host: ScriptHost, frames: RunnerEmissions[]): ScriptHost {
    return Object.freeze({
        load: host.load,
        push: host.push,
        async drain() {
            const next = await host.drain();
            frames.push(next);
            return next;
        },
        dispose: host.dispose,
        limits: host.limits,
    });
}

// A fixed linear viewport scope: the same exact-case projector the unit tests
// use, so the painted drawing call log is deterministic.
function linearScope(context: MockCanvasContext): PaintScope {
    return {
        context,
        bitmapSize: { width: 800, height: 400 },
        mediaSize: { width: 400, height: 200 },
        horizontalPixelRatio: 2,
        verticalPixelRatio: 2,
    };
}

describe("lightweight-charts adapter integration", () => {
    it("drives plots + drawings through the factory and paints the drawings via the series primitive", async () => {
        const { worker, scope } = pair();
        createWorkerBoot(scope);
        const frames: RunnerEmissions[] = [];
        const workerErrors: string[] = [];
        const host = captureHost(
            createWorkerHost({
                capabilities: LWC_CAPABILITIES,
                symInfo: LWC_SYM_INFO,
                workerLike: worker,
                onWorkerError: (m) => workerErrors.push(m),
            }),
            frames,
        );
        const adapter = createLightweightChartsAdapter({
            chartApi: new MockLwcApi(),
            candleSource: mockCandleSource(BARS, { interval: "1D", mode: "stream" }),
            capabilities: LWC_CAPABILITIES,
            host,
        });
        await adapter.host.load({ moduleSource: MODULE_SOURCE, manifest: MANIFEST });
        await runRendererLoop(adapter);

        // No worker error; the native series + EMA plot lit up.
        expect(workerErrors).toEqual([]);
        const plotCount = frames.reduce((sum, f) => sum + f.plots.length, 0);
        expect(plotCount).toBeGreaterThan(0);

        // Rebuild the live drawing buffer from the final-frame drawings — the
        // last-write-wins state the attached primitive would paint on a redraw.
        const buffer = new Map<string, DrawingEmission>();
        for (const f of frames) {
            for (const d of f.drawings) {
                if (d.op === "remove") buffer.delete(d.handleId);
                else buffer.set(d.handleId, d);
            }
        }
        // All three drawing handles survived to the final frame.
        const kinds = new Set([...buffer.values()].map((d) => d.drawingKind));
        expect(kinds).toEqual(new Set(["line", "rectangle", "fib-retracement"]));

        // Paint the buffered drawings exactly as the attached primitive does.
        const primitive = new DrawingPrimitive(buffer);
        primitive.attached({
            series: {
                priceToCoordinate: (p) => -2 * p + 600,
                coordinateToPrice: (y) => (y - 600) / -2,
            },
            chart: {
                timeScale: () => ({
                    getVisibleRange: () => ({ from: BARS[0].time, to: BARS[BARS.length - 1].time }),
                    timeToCoordinate: (t) =>
                        50 +
                        ((350 - 50) / (BARS[BARS.length - 1].time - BARS[0].time)) *
                            (t - BARS[0].time),
                }),
            },
        });
        const ctx = new MockCanvasContext();
        primitive.paneViews()[0].renderer().paintInto(linearScope(ctx));

        // The drawings painted: strokes (line / rect / fib levels) + a fill
        // (rect) + fib level labels (text).
        expect(ctx.calls.some((c) => c.kind === "stroke")).toBe(true);
        expect(ctx.calls.some((c) => c.kind === "fill")).toBe(true);
        expect(ctx.calls.some((c) => c.kind === "fillText")).toBe(true);

        // Pinned hash over the painted drawing call log — re-snap from the
        // failure message after a deliberate geometry change. Floats round to
        // 4 dp (see `hashCallLog`), so microscopic drift does not re-hash.
        expect(hashCallLog(ctx.calls)).toBe(PINNED_DRAWINGS_HASH);

        adapter.dispose();
    });
});

// Pinned by the integration test above. Update only on a deliberate change to
// the drawing geometry (`decomposeDrawing`) or the painter (`paintPrimitive`).
const PINNED_DRAWINGS_HASH = "59db639690e787ca0fb1861f07a14a21b8e1e36526fa77c5fa561d94b303938e";
