// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createWorkerBoot, type WorkerBootScope } from "./createWorkerBoot.js";
import { createWorkerHost } from "./createWorkerHost.js";
import type { HostCompiledScript, WorkerLike } from "./types.js";

// THRESHOLD_MS — wall-clock budget for `ITERATIONS` push→drain round-trips
// over a `MessageChannel`-backed shim. Each iteration loads a fresh worker,
// pushes a close, and drains. Local Apple-silicon (M-series) typical runs
// land near 1500ms because each iteration pays the data: URL dynamic-import
// cost; budget 6000ms for slower CI hardware.
const THRESHOLD_MS = 6_000;
const ITERATIONS = 25;

function pair(): { worker: WorkerLike; scope: WorkerBootScope } {
    const ch = new MessageChannel();
    ch.port1.start();
    ch.port2.start();
    return {
        worker: {
            // See `integration.test.ts` for the gating rationale: the host
            // subscribes to both `message` and `error`; `MessagePort` only
            // delivers `message`.
            addEventListener(type, listener) {
                if (type !== "message") return;
                ch.port1.addEventListener("message", (ev) => listener(ev as MessageEvent<unknown>));
            },
            postMessage(msg) {
                ch.port1.postMessage(msg);
            },
            terminate() {
                ch.port1.close();
                ch.port2.close();
            },
        },
        scope: {
            addEventListener(_type, listener) {
                ch.port2.addEventListener("message", (ev) => {
                    void listener(ev as MessageEvent<never>);
                });
            },
            postMessage(msg) {
                ch.port2.postMessage(msg);
            },
        },
    };
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
        multiSymbol: false,
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
        name: "bench",
        inputs: {},
        capabilities: ["indicators"],
        requestedIntervals: [],
        userPickableInterval: false,
        seriesCapacities: { ohlcv: 4 },
        maxLookback: 0,
    };
}

const SOURCE = `
export default {
    manifest: ${JSON.stringify(manifest())},
    compute: (ctx) => { ctx.plot("b:1:1#0", 1, {}); },
};
`;

const compiled: HostCompiledScript = { moduleSource: SOURCE, manifest: manifest() };

describe("host-worker round-trip threshold", () => {
    it(`runs ${ITERATIONS} push→drain cycles under ${THRESHOLD_MS}ms`, async () => {
        const start = performance.now();
        for (let i = 0; i < ITERATIONS; i += 1) {
            const { worker, scope } = pair();
            createWorkerBoot(scope);
            const host = createWorkerHost({
                capabilities: makeCapabilities(),
                workerLike: worker,
            });
            await host.load(compiled);
            await host.push({
                kind: "close",
                bar: {
                    time: i,
                    open: 1,
                    high: 1,
                    low: 1,
                    close: 1,
                    volume: 0,
                    symbol: "X",
                    interval: "1m",
                },
            });
            await new Promise((r) => setTimeout(r, 0));
            await host.drain();
            host.dispose();
        }
        const elapsed = performance.now() - start;
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
