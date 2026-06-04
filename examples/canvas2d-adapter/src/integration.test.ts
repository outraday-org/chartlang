// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import {
    createWorkerBoot,
    createWorkerHost,
    type WorkerBootScope,
    type WorkerLike,
} from "@invinite-org/chartlang-host-worker";
import { describe, expect, it } from "vitest";

import { CANVAS2D_CAPABILITIES } from "./capabilities";
import { createCanvas2dAdapter, runRendererLoop } from "./createCanvas2dAdapter";
import { MockCanvas2DContext, hashCallLog } from "./testing";

/**
 * Pair a `MessageChannel`-backed `WorkerLike` (port1, used by the host)
 * with a `WorkerBootScope` (port2, used by the boot factory). Cribbed
 * from `@invinite-org/chartlang-host-worker`'s integration test.
 */
function pair(): { worker: WorkerLike; scope: WorkerBootScope } {
    const ch = new MessageChannel();
    ch.port1.start();
    ch.port2.start();
    const worker: WorkerLike = {
        addEventListener(_type, listener) {
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

function bar(i: number, open: number, high: number, low: number, close: number): Bar {
    return {
        time: START_TIME + i * MS_PER_DAY,
        open,
        high,
        low,
        close,
        volume: 1_000 + i,
        symbol: "EMA-X",
        interval: "1D",
    };
}

/**
 * 120-bar dataset shaped so a 12-bar EMA crosses a 26-bar EMA in
 * both directions. The series starts with a 40-bar downtrend
 * (settles both EMAs aligned with falling price, fast EMA pinned
 * below slow EMA post-warmup), then a 40-bar uptrend (fast EMA
 * accelerates upward through the slow — crossover), then a 40-bar
 * downtrend (fast EMA falls back through the slow — crossunder).
 */
const HISTORY_BARS: ReadonlyArray<Bar> = Array.from({ length: 120 }, (_, i) => {
    const phase = Math.floor(i / 40); // 0 → down, 1 → up, 2 → down
    const within = i % 40;
    const close =
        phase === 0 ? 120 - within * 0.5 : phase === 1 ? 100 + within * 0.5 : 120 - within * 0.5;
    return bar(i, close - 0.5, close + 1, close - 1, close);
});

const EMA_CROSS_MANIFEST: ScriptManifest = {
    apiVersion: 1,
    kind: "indicator",
    name: "EMA Cross (integration fixture)",
    inputs: {},
    capabilities: ["indicators"],
    requestedIntervals: [],
    userPickableInterval: false,
    seriesCapacities: { ohlcv: 128 },
    maxLookback: 26,
};

/**
 * Hand-crafted compiled-bundle source equivalent to the EMA-cross
 * example script (`tasks/phase-1-walking-skeleton/11-examples-and-cli.md`
 * §1). Calls the runtime's slot-aware `ctx.ta.ema` / `ctx.plot` /
 * `ctx.alert` directly so the bundle has no static imports — the
 * data-URL `import(...)` path the worker uses cannot resolve workspace
 * specifiers. Task 12's CLI-driven pipeline (using `esbuild.build` with
 * a resolver) will exercise the real on-disk bundle.
 */
const EMA_CROSS_MODULE_SOURCE = `
export default {
    manifest: ${JSON.stringify(EMA_CROSS_MANIFEST)},
    compute: (ctx) => {
        const fast = ctx.ta.ema("ema-cross.chart.ts:5:22#0", ctx.bar.close, 12);
        const slow = ctx.ta.ema("ema-cross.chart.ts:6:22#0", ctx.bar.close, 26);
        ctx.plot("ema-cross.chart.ts:7:9#0", fast, { color: "#26a69a", title: "EMA(12)" });
        ctx.plot("ema-cross.chart.ts:8:9#0", slow, { color: "#ef5350", title: "EMA(26)" });
        const co = ctx.ta.crossover("ema-cross.chart.ts:9:16#0", fast, slow);
        const cu = ctx.ta.crossunder("ema-cross.chart.ts:12:16#0", fast, slow);
        if (co.current) {
            ctx.alert("ema-cross.chart.ts:10:13#0", "EMA(12) crossed above EMA(26)", { severity: "info" });
        }
        if (cu.current) {
            ctx.alert("ema-cross.chart.ts:13:13#0", "EMA(12) crossed below EMA(26)", { severity: "warning" });
        }
    },
};
`;

describe("canvas2d adapter integration", () => {
    it("drives an EMA-cross-equivalent compiled bundle through the worker shim and renders to the mock canvas", async () => {
        const { worker, scope } = pair();
        createWorkerBoot(scope);
        const workerErrors: string[] = [];
        const host = createWorkerHost({
            capabilities: CANVAS2D_CAPABILITIES,
            workerLike: worker,
            onWorkerError: (m) => workerErrors.push(m),
        });

        const ctx = new MockCanvas2DContext();
        const alertsReceived: unknown[] = [];
        const adapter = createCanvas2dAdapter({
            canvas: { width: 800, height: 400 },
            ctx,
            // Stream mode — one `close` event per bar so `runRendererLoop`
            // drains between bars and the adapter sees per-bar alert /
            // plot emissions (per PLAN §6.7: onBarClose resets the
            // emissions queue at the start of each bar).
            candleSource: mockCandleSource(HISTORY_BARS, {
                interval: "1D",
                mode: "stream",
            }),
            capabilities: CANVAS2D_CAPABILITIES,
            host,
            onAlert: (a) => alertsReceived.push(a),
        });

        await adapter.host.load({
            moduleSource: EMA_CROSS_MODULE_SOURCE,
            manifest: EMA_CROSS_MANIFEST,
        });
        await runRendererLoop(adapter);

        // Structural assertions — every Phase-1 primitive surface lights up.
        const fillRects = ctx.calls.filter((c) => c.kind === "fillRect").length;
        const strokes = ctx.calls.filter((c) => c.kind === "stroke").length;
        const arcs = ctx.calls.filter((c) => c.kind === "arc").length;
        expect(workerErrors).toEqual([]);
        expect(fillRects).toBeGreaterThanOrEqual(HISTORY_BARS.length); // candle bodies
        expect(strokes).toBeGreaterThanOrEqual(HISTORY_BARS.length + 2); // wicks + ≥1 polyline
        expect(arcs).toBeGreaterThanOrEqual(1); // at least one alert badge
        expect(alertsReceived.length).toBeGreaterThanOrEqual(1);

        // Pinned hash — re-snap after a deliberate visual change by
        // reading the new value off this assertion's failure message.
        const hash = hashCallLog(ctx.calls);
        expect(hash).toBe(PINNED_HASH);

        adapter.dispose();
    });
});

// Pinned by the integration test; update only when a deliberate visual
// change re-shapes the renderer's draw sequence. The hash canonicalises
// floats to 4 decimal places (see `hashCallLog` in `./testing`) so
// microscopic numeric drift does not re-hash the log.
const PINNED_HASH = "a7f041f1ce9b818d5578db39b4021a54632a86ea3a5cb5b35625aa2400934d5f";
