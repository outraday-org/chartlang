// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { createWorkerBoot, createWorkerHost } from "@invinite-org/chartlang-host-worker";
import type {
    HostCompiledScript,
    WorkerBootScope,
    WorkerLike,
} from "@invinite-org/chartlang-host-worker";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createQuickJsHost } from "./createQuickJsHost";

type ScriptFixture = Readonly<{
    name: string;
    source: string;
    manifest: ScriptManifest;
}>;

function makeCapabilities(): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: capabilities.allPhase3Drawings(),
        alerts: new Set(["default"]),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 10, labels: 10, boxes: 10, polylines: 10, other: 10 },
        maxLookback: 5_000,
        maxTickHz: 10,
    };
}

function manifest(name: string): ScriptManifest {
    return {
        apiVersion: 1,
        kind: "indicator",
        name,
        inputs: {},
        capabilities: ["indicators"],
        requestedIntervals: [],
        userPickableInterval: false,
        seriesCapacities: { ohlcv: 32 },
        maxLookback: 10,
    };
}

function bars(count: number): ReadonlyArray<Bar> {
    return Array.from({ length: count }, (_, index) => {
        const close = index + 1;
        const open = close - 0.5;
        const high = close + 1;
        const low = close - 1;
        return {
            time: index + 1,
            open,
            high,
            low,
            close,
            hl2: (high + low) / 2,
            hlc3: (high + low + close) / 3,
            ohlc4: (open + high + low + close) / 4,
            hlcc4: (high + low + close + close) / 4,
            volume: close * 100,
            symbol: "X",
            interval: "1m",
        };
    });
}

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

function source(m: ScriptManifest, compute: string): string {
    return `
export default {
    manifest: ${JSON.stringify(m)},
    compute: ${compute},
};
`;
}

const FIXTURES: ReadonlyArray<ScriptFixture> = [
    {
        name: "constant plot",
        manifest: manifest("constant plot"),
        source: source(
            manifest("constant plot"),
            `({ bar, plot }) => { plot("parity.constant:1:1#0", bar.close, {}); }`,
        ),
    },
    {
        name: "ema",
        manifest: manifest("ema"),
        source: source(
            manifest("ema"),
            `({ bar, ta, plot }) => {
                const ema = ta.ema("parity.ema:1:1#0", bar.close, 3);
                plot("parity.ema:1:2#0", ema, {});
            }`,
        ),
    },
    {
        name: "bb",
        manifest: manifest("bb"),
        source: source(
            manifest("bb"),
            `({ bar, ta, plot }) => {
                const bb = ta.bb("parity.bb:1:1#0", bar.close, 3);
                plot("parity.bb:1:2#0", bb.upper, {});
                plot("parity.bb:1:3#0", bb.middle, {});
                plot("parity.bb:1:4#0", bb.lower, {});
            }`,
        ),
    },
    {
        name: "alert",
        manifest: manifest("alert"),
        source: source(
            manifest("alert"),
            `({ bar, alert }) => {
                if (bar.close >= 5) alert("parity.alert:1:1#0", "threshold", {});
            }`,
        ),
    },
    {
        name: "draw line",
        manifest: manifest("draw line"),
        source: source(
            manifest("draw line"),
            `({ bar, draw }) => {
                draw.line(
                    "parity.draw:1:1#0",
                    { time: bar.time, price: bar.low },
                    { time: bar.time, price: bar.high },
                    { color: "#3b82f6" },
                );
            }`,
        ),
    },
];

async function runWorker(fixture: ScriptFixture): Promise<string> {
    const { worker, scope } = pair();
    createWorkerBoot(scope);
    const host = createWorkerHost({
        capabilities: makeCapabilities(),
        workerLike: worker,
    });
    const compiled: HostCompiledScript = {
        moduleSource: fixture.source,
        manifest: fixture.manifest,
    };
    await host.load(compiled);
    await host.push({ kind: "history", bars: bars(10) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const emissions = await host.drain();
    host.dispose();
    return JSON.stringify(emissions);
}

async function runQuickJs(fixture: ScriptFixture): Promise<string> {
    const host = createQuickJsHost({ capabilities: makeCapabilities() });
    await host.load({
        moduleSource: fixture.source,
        manifest: fixture.manifest,
    });
    await host.push({ kind: "history", bars: bars(10) });
    const emissions = await host.drain();
    host.dispose();
    return JSON.stringify(emissions);
}

describe("host-quickjs integration parity", () => {
    for (const fixture of FIXTURES) {
        it(`matches host-worker emissions for ${fixture.name}`, async () => {
            await expect(runQuickJs(fixture)).resolves.toBe(await runWorker(fixture));
        });
    }
});
