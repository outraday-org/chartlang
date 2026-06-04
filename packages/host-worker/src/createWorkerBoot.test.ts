// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities, CandleEvent } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createWorkerBoot, type WorkerBootScope } from "./createWorkerBoot";
import type { HostLimits } from "./types";
import type { HostToWorker, WorkerToHost } from "./protocol";

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

const LIMITS: HostLimits = {
    maxHeapBytes: 64 * 1024 * 1024,
    maxCpuMsPerStep: 50,
    maxRingBufferBars: 5_000,
};

function manifest(): ScriptManifest {
    return {
        apiVersion: 1,
        kind: "indicator",
        name: "demo",
        inputs: {},
        capabilities: ["indicators"],
        requestedIntervals: [],
        userPickableInterval: false,
        seriesCapacities: { ohlcv: 4 },
        maxLookback: 0,
    };
}

/**
 * A minimal compiled script source. `compute` is a no-op so the module loads
 * + drains an empty emissions queue.
 */
const NOOP_MODULE_SOURCE = `
export default {
    manifest: ${JSON.stringify(manifest())},
    compute: () => {},
};
`;

const SLOW_MODULE_SOURCE = `
export default {
    manifest: ${JSON.stringify(manifest())},
    compute: () => {
        const t0 = Date.now();
        while (Date.now() - t0 < 30) { /* spin */ }
    },
};
`;

/**
 * A module that throws on instantiation by emitting non-callable `compute`.
 * `createScriptRunner` accepts the object but the first `onHistory` call
 * would throw — used to assert load itself succeeds.
 */
const BROKEN_MANIFEST_MODULE_SOURCE = `throw new Error("bad bundle");`;

type Captured = WorkerToHost;

function makeScope(): {
    scope: WorkerBootScope;
    deliver: (msg: HostToWorker) => Promise<void>;
    captured: ReadonlyArray<Captured>;
    waitFor: (kind: WorkerToHost["kind"]) => Promise<Captured>;
} {
    let listener: ((ev: MessageEvent<HostToWorker>) => Promise<void> | void) | null = null;
    const captured: Array<Captured> = [];
    const waiters: Array<{ kind: WorkerToHost["kind"]; resolve: (m: Captured) => void }> = [];
    const scope: WorkerBootScope = {
        addEventListener(_type, l) {
            listener = l as (ev: MessageEvent<HostToWorker>) => Promise<void> | void;
        },
        postMessage(msg) {
            captured.push(msg);
            for (let i = waiters.length - 1; i >= 0; i -= 1) {
                if (waiters[i].kind === msg.kind) {
                    waiters[i].resolve(msg);
                    waiters.splice(i, 1);
                }
            }
        },
    };
    return {
        scope,
        captured,
        deliver: async (msg) => {
            if (listener === null) throw new Error("no listener attached");
            await listener({ data: msg } as MessageEvent<HostToWorker>);
        },
        waitFor: (kind) =>
            new Promise<Captured>((resolve) => {
                const existing = captured.find((c) => c.kind === kind);
                if (existing !== undefined) {
                    resolve(existing);
                    return;
                }
                waiters.push({ kind, resolve });
            }),
    };
}

function bar(time: number, close: number): Bar {
    return {
        time,
        open: close,
        high: close,
        low: close,
        close,
        volume: 0,
        symbol: "X",
        interval: "1m",
    };
}

function historyEvent(): CandleEvent {
    return { kind: "history", bars: [bar(1, 1), bar(2, 2)] };
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("createWorkerBoot", () => {
    it("posts 'loaded' after a successful load", async () => {
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        await deliver({
            kind: "load",
            compiled: { moduleSource: NOOP_MODULE_SOURCE, manifest: manifest() },
            capabilities: makeCapabilities(),
            limits: LIMITS,
        });
        await waitFor("loaded");
    });

    it("posts 'loadError' when the module source throws on import", async () => {
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        await deliver({
            kind: "load",
            compiled: { moduleSource: BROKEN_MANIFEST_MODULE_SOURCE, manifest: manifest() },
            capabilities: makeCapabilities(),
            limits: LIMITS,
        });
        const reply = await waitFor("loadError");
        if (reply.kind !== "loadError") throw new Error("expected loadError");
        expect(reply.message).toContain("bad bundle");
    });

    it("posts 'loadError' with String(err) when the throw is not an Error", async () => {
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        await deliver({
            kind: "load",
            compiled: { moduleSource: `throw "plain string";`, manifest: manifest() },
            capabilities: makeCapabilities(),
            limits: LIMITS,
        });
        const reply = await waitFor("loadError");
        if (reply.kind !== "loadError") throw new Error("expected loadError");
        expect(reply.message).toBe("plain string");
    });

    it("rejects candleEvent before load with a fatal", async () => {
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        await deliver({ kind: "candleEvent", event: historyEvent() });
        const reply = await waitFor("fatal");
        if (reply.kind !== "fatal") throw new Error("expected fatal");
        expect(reply.message).toBe("candleEvent before load");
    });

    it("rejects drain before load with a fatal", async () => {
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        await deliver({ kind: "drain", nonce: 0 });
        const reply = await waitFor("fatal");
        if (reply.kind !== "fatal") throw new Error("expected fatal");
        expect(reply.message).toBe("drain before load");
    });

    it("converts non-Error throws inside dispatch into String(err) fatals", async () => {
        const { scope, deliver, captured } = makeScope();
        createWorkerBoot(scope);
        const moduleSource = `
            export default {
                manifest: ${JSON.stringify(manifest())},
                compute: () => { throw "string boom"; },
            };
        `;
        await deliver({
            kind: "load",
            compiled: { moduleSource, manifest: manifest() },
            capabilities: makeCapabilities(),
            limits: LIMITS,
        });
        await deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(1, 1) } });
        const fatal = captured.find((c) => c.kind === "fatal");
        if (fatal === undefined || fatal.kind !== "fatal") throw new Error("expected fatal");
        expect(fatal.message).toBe("string boom");
    });

    it("dispatches a history candleEvent to the runner and drains emissions", async () => {
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        await deliver({
            kind: "load",
            compiled: { moduleSource: NOOP_MODULE_SOURCE, manifest: manifest() },
            capabilities: makeCapabilities(),
            limits: LIMITS,
        });
        await waitFor("loaded");
        await deliver({ kind: "candleEvent", event: historyEvent() });
        await deliver({ kind: "drain", nonce: 7 });
        const reply = await waitFor("emissions");
        if (reply.kind !== "emissions") throw new Error("expected emissions");
        expect(reply.nonce).toBe(7);
        expect(reply.emissions.plots).toEqual([]);
        expect(reply.emissions.alerts).toEqual([]);
    });

    it("dispatches close + tick candleEvents", async () => {
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        await deliver({
            kind: "load",
            compiled: { moduleSource: NOOP_MODULE_SOURCE, manifest: manifest() },
            capabilities: makeCapabilities(),
            limits: LIMITS,
        });
        await waitFor("loaded");
        await deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(1, 1) } });
        await deliver({ kind: "candleEvent", event: { kind: "tick", bar: bar(1, 2) } });
        // No reply expected — fire-and-forget. drain confirms runner survived.
        await deliver({ kind: "drain", nonce: 0 });
        await waitFor("emissions");
    });

    it("posts 'step-overshoot' when a step exceeds maxCpuMsPerStep", async () => {
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        await deliver({
            kind: "load",
            compiled: { moduleSource: SLOW_MODULE_SOURCE, manifest: manifest() },
            capabilities: makeCapabilities(),
            limits: { ...LIMITS, maxCpuMsPerStep: 1 },
        });
        await waitFor("loaded");
        await deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(1, 1) } });
        const reply = await waitFor("step-overshoot");
        if (reply.kind !== "step-overshoot") throw new Error("expected step-overshoot");
        expect(reply.observedMs).toBeGreaterThan(1);
    });

    it("posts a fatal when the inbound frame is null", async () => {
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        await deliver(null as unknown as HostToWorker);
        const reply = await waitFor("fatal");
        if (reply.kind !== "fatal") throw new Error("expected fatal");
        expect(reply.message).toContain("malformed host frame");
    });

    it("posts a fatal when the inbound frame is missing 'kind'", async () => {
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        await deliver({} as unknown as HostToWorker);
        const reply = await waitFor("fatal");
        if (reply.kind !== "fatal") throw new Error("expected fatal");
        expect(reply.message).toContain("malformed host frame");
    });

    it("posts a fatal when the inbound frame's 'kind' is unrecognised", async () => {
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        await deliver({
            kind: "load",
            compiled: { moduleSource: NOOP_MODULE_SOURCE, manifest: manifest() },
            capabilities: makeCapabilities(),
            limits: LIMITS,
        });
        await waitFor("loaded");
        await deliver({ kind: "lolwut" } as unknown as HostToWorker);
        const reply = await waitFor("fatal");
        if (reply.kind !== "fatal") throw new Error("expected fatal");
        expect(reply.message).toContain("unknown frame kind: lolwut");
    });

    it("accepts a multi-byte UTF-8 module source via the data: URL", async () => {
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        const moduleSource = `
            // émoji α β γ — UTF-8 round-trip smoke test.
            export default {
                manifest: ${JSON.stringify(manifest())},
                compute: () => {},
            };
        `;
        await deliver({
            kind: "load",
            compiled: { moduleSource, manifest: manifest() },
            capabilities: makeCapabilities(),
            limits: LIMITS,
        });
        await waitFor("loaded");
    });

    it("disposes the runner; subsequent drain raises fatal", async () => {
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        await deliver({
            kind: "load",
            compiled: { moduleSource: NOOP_MODULE_SOURCE, manifest: manifest() },
            capabilities: makeCapabilities(),
            limits: LIMITS,
        });
        await waitFor("loaded");
        await deliver({ kind: "dispose" });
        await deliver({ kind: "drain", nonce: 0 });
        const reply = await waitFor("fatal");
        if (reply.kind !== "fatal") throw new Error("expected fatal");
        expect(reply.message).toBe("drain before load");
    });
});
