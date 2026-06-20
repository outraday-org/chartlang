// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import {
    type WorkerBootScope,
    type WorkerLike,
    createWorkerBoot,
    createWorkerHost,
} from "@invinite-org/chartlang-host-worker";
import { describe, expect, it } from "vitest";

import { UPLOT_CAPABILITIES, UPLOT_SYM_INFO } from "./capabilities.js";
import { createUplotAdapter, runUplotLoop } from "./createUplotAdapter.js";
import { type MockUplot, hashCallLog, makeMockUplotFactory } from "./testing.js";

/**
 * Pair a `MessageChannel`-backed `WorkerLike` (port1, host side) with a
 * `WorkerBootScope` (port2, boot side). Cribbed from the canvas2d
 * adapter's integration test so the bundle runs through the real worker
 * shim, not a stub host.
 */
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
const START = 1_700_000_000_000;

function bar(i: number, open: number, high: number, low: number, close: number): Bar {
    return {
        time: START + i * MS_PER_DAY,
        open,
        high,
        low,
        close,
        volume: 1_000 + i,
        symbol: "DEMO",
        interval: "1D",
        hl2: (high + low) / 2,
        hlc3: (high + low + close) / 3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
    };
}

// A short trending window: enough bars for a line + box drawing to span a
// finite, distinct world region.
const BARS: ReadonlyArray<Bar> = Array.from({ length: 12 }, (_, i) =>
    bar(i, 100 + i, 102 + i, 99 + i, 101 + i),
);

const MANIFEST: ScriptManifest = {
    apiVersion: 1,
    kind: "indicator",
    name: "uplot drawings (integration fixture)",
    inputs: {},
    capabilities: ["indicators"],
    requestedIntervals: [],
    userPickableInterval: false,
    seriesCapacities: { ohlcv: 16 },
    maxLookback: 5,
};

// A hand-crafted compiled bundle (the same literal-`{ manifest, compute }`
// pattern canvas2d's integration test uses, since the Phase-1 worker
// `data:` URL import cannot resolve workspace specifiers). It plots an
// SMA-equivalent line and reuses two drawings — a `draw.line` trend and a
// `draw.rectangle` — both anchored to absolute bar times so they project
// into the visible window and exercise the draw-hook geometry pass.
const MODULE_SOURCE = `
export default {
    manifest: ${JSON.stringify(MANIFEST)},
    compute: (ctx) => {
        const sma = ctx.ta.sma("uplot.chart.ts:5:21#0", ctx.bar.close, 5);
        ctx.plot("uplot.chart.ts:6:9#0", sma, { color: "#3b82f6", title: "SMA(5)" });
        const first = ctx.state.float("uplot.chart.ts:7:25#0", Number.NaN);
        if (Number.isNaN(first.value)) {
            first.value = ctx.bar.time;
        }
        ctx.draw.line(
            "uplot.chart.ts:12:9#0",
            { time: first.value, price: 101 },
            ctx.bar.point(0, ctx.bar.close),
            { color: "#ab47bc", lineWidth: 2 },
        );
        ctx.draw.rectangle(
            "uplot.chart.ts:18:9#0",
            { time: first.value, price: 100 },
            ctx.bar.point(0, ctx.bar.high),
            { stroke: "#16a34a", fill: "#22c55e" },
        );
    },
};
`;

async function runFixture(): Promise<{ overlay: MockUplot }> {
    const { worker, scope } = pair();
    createWorkerBoot(scope);
    const workerErrors: string[] = [];
    const host = createWorkerHost({
        capabilities: UPLOT_CAPABILITIES,
        symInfo: UPLOT_SYM_INFO,
        workerLike: worker,
        onWorkerError: (m) => workerErrors.push(m),
    });
    const { factory, instances } = makeMockUplotFactory();
    const adapter = createUplotAdapter({
        target: {} as HTMLElement,
        width: 800,
        height: 400,
        uplotFactory: factory,
        candleSource: mockCandleSource(BARS, { interval: "1D", mode: "stream" }),
        capabilities: UPLOT_CAPABILITIES,
        host,
    });
    await adapter.host.load({ moduleSource: MODULE_SOURCE, manifest: MANIFEST });
    await runUplotLoop(adapter);
    expect(workerErrors).toEqual([]);
    const overlay = instances[0];
    overlay.runDraw();
    adapter.dispose();
    return { overlay };
}

describe("uplot adapter integration — plots + drawings draw-hook pass", () => {
    it("drives a compiled bundle through the worker shim and paints plots + drawings", async () => {
        const { overlay } = await runFixture();

        // Candles paint one body (fillRect) per bar, then the drawing pass
        // brackets its prims in a single save/translate/restore.
        expect(overlay.ctx.calls.filter((c) => c.kind === "fillRect").length).toBe(BARS.length);
        expect(overlay.ctx.calls.filter((c) => c.kind === "translate")).toHaveLength(1);
        // The purple trend line strokes; the green rectangle fills + closes.
        const purpleStroke = overlay.ctx.calls.some(
            (c) => c.kind === "set" && c.prop === "strokeStyle" && c.value === "#ab47bc",
        );
        const greenFill = overlay.ctx.calls.some(
            (c) => c.kind === "set" && c.prop === "fillStyle" && c.value === "#22c55e",
        );
        expect(purpleStroke).toBe(true);
        expect(greenFill).toBe(true);
        expect(overlay.ctx.calls.some((c) => c.kind === "closePath")).toBe(true);
    });

    it("pins the draw-pass call-log hash", async () => {
        const { overlay } = await runFixture();
        // Re-pin only on a deliberate visual change by reading the new value
        // off this assertion's failure message. `hashCallLog` canonicalises
        // floats to 4 dp so microscopic drift does not re-hash.
        expect(hashCallLog(overlay.ctx.calls)).toBe(PINNED_HASH);
    });
});

// Pinned by the integration test (see the note above).
const PINNED_HASH = "64a1fd37565c054045b9aad07722873f51a18e4a0c500852d49b29bc48e24a57";
