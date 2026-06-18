// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createWorkerBoot, type WorkerBootScope } from "./createWorkerBoot.js";
import { createWorkerHost } from "./createWorkerHost.js";
import type { HostCompiledScript, WorkerLike } from "./types.js";

/**
 * Wire a `MessageChannel`-backed `WorkerLike` (port1) into the main-side host
 * and a `WorkerBootScope` (port2) into the boot factory. The `addEventListener`
 * shape on `MessagePort` requires `.start()` to begin delivery, which we call
 * once during setup.
 */
function pair(): { worker: WorkerLike; scope: WorkerBootScope } {
    const ch = new MessageChannel();
    ch.port1.start();
    ch.port2.start();
    const worker: WorkerLike = {
        // The host subscribes to both "message" and "error" — `MessagePort`
        // only exposes "message" delivery, so the "error" subscription is a
        // silent no-op (matches production where browsers fire `error` only
        // for the parent `Worker`, not the wrapped port). Without this guard
        // the host's error listener would receive every message event.
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

function makeCapabilities(): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: new Set(),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        maxLookback: 5_000,
        maxTickHz: 10,
    };
}

function manifest(): ScriptManifest {
    return {
        apiVersion: 1,
        kind: "indicator",
        name: "constant-plot",
        inputs: {},
        capabilities: ["indicators"],
        requestedIntervals: [],
        userPickableInterval: false,
        seriesCapacities: { ohlcv: 16 },
        maxLookback: 0,
    };
}

/**
 * A minimal compiled script that plots `42` on every bar. The compute body
 * mirrors what the Phase-1 compiler would emit: an inlined slotId on every
 * stateful primitive call.
 */
const CONSTANT_PLOT_SOURCE = `
export default {
    manifest: ${JSON.stringify(manifest())},
    compute: (ctx) => {
        ctx.plot("integration.chart.ts:1:1#0", 42, {});
    },
};
`;

function bar(time: number, close: number): Bar {
    return {
        time,
        open: close,
        high: close,
        low: close,
        close,
        volume: 1,
        symbol: "X",
        interval: "1m",
    };
}

function mtfCapabilities(): Capabilities {
    return {
        ...makeCapabilities(),
        intervals: [
            { value: "1m", label: "1 minute", group: "minute" },
            { value: "1D", label: "1 day", group: "daily" },
        ],
        multiTimeframe: true,
    };
}

function exprManifest(): ScriptManifest {
    return {
        ...manifest(),
        name: "htf-expr",
        requestedIntervals: ["1D"],
        seriesCapacities: { ohlcv: 64 },
        maxLookback: 63,
        securityExpressions: [{ slotId: "expr.chart.ts:1:1#0", interval: "1D", paramName: "bar" }],
    };
}

// The compiled module the compiler would emit for the expression form: the
// callsite carries an injected slotId, and the callback's `ta.ema` carries its
// own injected slotId. It also plots a same-length MAIN-clock EMA so the test
// can prove the weekly value differs from the main-clock value.
const HTF_EXPR_SOURCE = `
export default {
    manifest: ${JSON.stringify(exprManifest())},
    compute: (ctx) => {
        const weekly = ctx.request.security(
            "expr.chart.ts:1:1#0",
            { interval: "1D" },
            (bar) => ctx.ta.ema("expr.chart.ts:1:1#0/ema", bar.close, 3),
        );
        const mainEma = ctx.ta.ema("expr.chart.ts:2:1#0", ctx.bar.close, 3);
        ctx.plot("expr.chart.ts:3:1#0", weekly.current, {});
        ctx.plot("expr.chart.ts:4:1#0", mainEma.current, {});
    },
};
`;

function dailyBar(time: number, close: number): Bar {
    return {
        time,
        open: close,
        high: close + 1,
        low: close - 1,
        close,
        volume: 10,
        symbol: "X",
        interval: "1D",
    };
}

describe("host-worker integration", () => {
    it("boots the request.security expression form and aligns a weekly EMA", async () => {
        const { worker, scope } = pair();
        createWorkerBoot(scope);
        const host = createWorkerHost({
            capabilities: mtfCapabilities(),
            workerLike: worker,
        });

        const compiled: HostCompiledScript = {
            moduleSource: HTF_EXPR_SOURCE,
            manifest: exprManifest(),
        };
        await host.load(compiled);

        // Four daily closes precede the main bars, then a few main closes.
        await host.push({
            kind: "history",
            bars: [10, 20, 30, 40].map((c, i) => dailyBar(i * 86_400_000, c)),
            streamKey: "1D",
        });
        await host.push({
            kind: "history",
            bars: [
                bar(4 * 86_400_000, 40),
                bar(4 * 86_400_000 + 60_000, 41),
                bar(4 * 86_400_000 + 120_000, 42),
                bar(4 * 86_400_000 + 180_000, 43),
            ],
        });
        await new Promise((r) => setTimeout(r, 20));

        const drained = await host.drain();
        const weeklyPlots = drained.plots.filter((p) => p.slotId === "expr.chart.ts:3:1#0");
        const mainPlots = drained.plots.filter((p) => p.slotId === "expr.chart.ts:4:1#0");
        const weeklyHead = weeklyPlots[weeklyPlots.length - 1].value;
        const mainHead = mainPlots[mainPlots.length - 1].value;

        // EMA(3) over weekly [10,20,30,40] head = 30; finite and distinct from
        // the same-length main-clock EMA(3) (which warms to 42 over [40..43]).
        expect(Number.isFinite(weeklyHead)).toBe(true);
        expect(weeklyHead).toBeCloseTo(30, 6);
        expect(Number.isFinite(mainHead)).toBe(true);
        expect(weeklyHead).not.toBeCloseTo(mainHead, 3);
        expect(drained.diagnostics).toEqual([]);

        host.dispose();
    });

    it("round-trips a constant-plot script through load + push + drain", async () => {
        const { worker, scope } = pair();
        createWorkerBoot(scope);
        const host = createWorkerHost({
            capabilities: makeCapabilities(),
            workerLike: worker,
        });

        const compiled: HostCompiledScript = {
            moduleSource: CONSTANT_PLOT_SOURCE,
            manifest: manifest(),
        };
        await host.load(compiled);

        // History warms the runner — a bulk push is one event followed by
        // one drain, and onHistory accumulates every bar's emissions across
        // the walk (PLAN §6.1 "everything since last drain"), so three
        // history bars yield three plots.
        await host.push({
            kind: "history",
            bars: [bar(1, 1), bar(2, 2), bar(3, 3)],
        });
        await new Promise((r) => setTimeout(r, 20));

        const historyDrain = await host.drain();
        expect(historyDrain.plots).toHaveLength(3);
        for (const plot of historyDrain.plots) {
            expect(plot.value).toBe(42);
            expect(plot.slotId).toBe("integration.chart.ts:1:1#0");
        }

        // A subsequent close advances the runner; drain returns exactly the
        // new bar's plot.
        await host.push({ kind: "close", bar: bar(4, 4) });
        await new Promise((r) => setTimeout(r, 10));
        const tickDrain = await host.drain();
        expect(tickDrain.plots).toHaveLength(1);
        expect(tickDrain.plots[0].bar).toBe(historyDrain.plots[2].bar + 1);

        host.dispose();
    });

    it("rejects load() when the bundle cannot be imported", async () => {
        const { worker, scope } = pair();
        createWorkerBoot(scope);
        const host = createWorkerHost({
            capabilities: makeCapabilities(),
            workerLike: worker,
        });
        const compiled: HostCompiledScript = {
            moduleSource: `throw new Error("bundle blew up");`,
            manifest: manifest(),
        };
        await expect(host.load(compiled)).rejects.toThrow("bundle blew up");
        host.dispose();
    });

    it("surfaces a runtime throw through onWorkerError", async () => {
        const { worker, scope } = pair();
        createWorkerBoot(scope);
        let lastError: string | null = null;
        const host = createWorkerHost({
            capabilities: makeCapabilities(),
            workerLike: worker,
            onWorkerError: (m) => {
                lastError = m;
            },
        });
        const compiled: HostCompiledScript = {
            moduleSource: `
                export default {
                    manifest: ${JSON.stringify(manifest())},
                    compute: () => { throw new Error("compute boom"); },
                };
            `,
            manifest: manifest(),
        };
        await host.load(compiled);
        await host.push({ kind: "close", bar: bar(1, 1) });
        await new Promise((r) => setTimeout(r, 20));
        expect(lastError).toBe("compute boom");
        host.dispose();
    });
});
