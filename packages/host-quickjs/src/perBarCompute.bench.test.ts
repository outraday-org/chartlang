// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import {
    createWorkerBoot,
    createWorkerHost,
    type HostCompiledScript,
    type WorkerBootScope,
    type WorkerLike,
} from "@invinite-org/chartlang-host-worker";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createQuickJsHost } from "./createQuickJsHost.js";
import type { ScriptHost } from "./types.js";

const ITERATIONS = 1_000;
const THRESHOLD_MULTIPLIER = 50;

function pair(): { worker: WorkerLike; scope: WorkerBootScope } {
    const ch = new MessageChannel();
    ch.port1.start();
    ch.port2.start();
    return {
        worker: {
            addEventListener(_type, listener) {
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
        name: "per-bar compute threshold",
        inputs: {},
        capabilities: ["indicators"],
        requestedIntervals: [],
        userPickableInterval: false,
        seriesCapacities: { ohlcv: 64 },
        maxLookback: 50,
    };
}

function bar(index: number): Bar {
    const close = 100 + Math.sin(index / 10) * 5 + index * 0.01;
    const open = close - 0.25;
    const high = close + 0.5;
    const low = close - 0.5;
    return {
        time: 1_700_000_000_000 + index * 60_000,
        open,
        high,
        low,
        close,
        hl2: (high + low) / 2,
        hlc3: (high + low + close) / 3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
        volume: 1_000 + index,
        symbol: "X",
        interval: "1m",
    };
}

const MANIFEST = manifest();
const SOURCE = `
export default {
    manifest: ${JSON.stringify(MANIFEST)},
    compute: ({ bar, ta, plot }) => {
        const ema = ta.ema("per-bar.ema:1:1#0", bar.close, 20);
        const rsi = ta.rsi("per-bar.rsi:1:1#0", bar.close, 14);
        plot("per-bar.plot:1:1#0", ema.current + rsi.current, {});
    },
};
`;
const COMPILED: HostCompiledScript = { moduleSource: SOURCE, manifest: MANIFEST };

async function timeHost(host: ScriptHost): Promise<number> {
    const startedAt = performance.now();
    await host.load(COMPILED);
    for (let i = 0; i < ITERATIONS; i += 1) {
        await host.push({ kind: "close", bar: bar(i) });
        await host.drain();
    }
    host.dispose();
    return performance.now() - startedAt;
}

async function timeWorker(): Promise<number> {
    const { worker, scope } = pair();
    createWorkerBoot(scope);
    return timeHost(createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker }));
}

// PLAN §8.3 budgets QuickJS at roughly 10-100x slower than V8 for alert-class
// workloads. The CI gate uses 50x, the middle of that documented range, and
// measures the host-worker baseline in the same process before QuickJS.
describe("host-quickjs per-bar compute threshold", () => {
    it(`runs within host-worker baseline × ${THRESHOLD_MULTIPLIER}`, async () => {
        const workerMs = await timeWorker();
        const quickJsMs = await timeHost(createQuickJsHost({ capabilities: makeCapabilities() }));

        expect(quickJsMs).toBeLessThan(workerMs * THRESHOLD_MULTIPLIER);
        // Generous wall-clock guard: the assertion above is a *relative* ratio
        // (QuickJS vs the worker baseline timed in the same process), so it is
        // load-independent. The absolute timeout only needs to survive heavy
        // CPU contention when the full suite runs this in parallel with ~960
        // other test files; 30s starves under that load even though the test
        // completes in ~200ms in isolation.
    }, 90_000);
});
