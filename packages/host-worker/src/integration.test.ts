// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createWorkerBoot, type WorkerBootScope } from "./createWorkerBoot";
import { createWorkerHost } from "./createWorkerHost";
import type { HostCompiledScript, WorkerLike } from "./types";

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

describe("host-worker integration", () => {
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

        // History warms the runner — three closes drained as one final step
        // queue (runtime clears per-bar emissions on each onBarClose).
        await host.push({
            kind: "history",
            bars: [bar(1, 1), bar(2, 2), bar(3, 3)],
        });
        await new Promise((r) => setTimeout(r, 20));

        const historyDrain = await host.drain();
        expect(historyDrain.plots).toHaveLength(1);
        expect(historyDrain.plots[0].value).toBe(42);
        expect(historyDrain.plots[0].slotId).toBe("integration.chart.ts:1:1#0");

        // A subsequent close advances the runner; drain returns exactly the
        // new bar's plot.
        await host.push({ kind: "close", bar: bar(4, 4) });
        await new Promise((r) => setTimeout(r, 10));
        const tickDrain = await host.drain();
        expect(tickDrain.plots).toHaveLength(1);
        expect(tickDrain.plots[0].bar).toBe(historyDrain.plots[0].bar + 1);

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
