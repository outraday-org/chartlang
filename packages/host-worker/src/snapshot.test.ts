// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import "fake-indexeddb/auto";

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type {
    Bar,
    ScriptManifest,
    StateSnapshot,
    StateStoreKey,
} from "@invinite-org/chartlang-core";
import { isSnapshotError } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { type WorkerBootScope, createWorkerBoot } from "./createWorkerBoot.js";
import { createWorkerHost } from "./createWorkerHost.js";
import type { HostToWorker, WorkerToHost } from "./protocol.js";
import type { HostCompiledScript, HostLimits, HostSnapshot, WorkerLike } from "./types.js";

const LIMITS: HostLimits = {
    maxHeapBytes: 64 * 1024 * 1024,
    maxCpuMsPerStep: 50,
    maxRingBufferBars: 5_000,
    maxLoadTimeoutMs: 30_000,
};

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
        name: "running-sum",
        inputs: {},
        capabilities: ["indicators"],
        requestedIntervals: [],
        userPickableInterval: false,
        seriesCapacities: { ohlcv: 16 },
        maxLookback: 4,
    };
}

/**
 * Compiled module whose plotted value depends on a `state.*` slot AND a `ta.*`
 * accumulator, so an equivalence check across a snapshot boundary fails unless
 * both families survive the round trip.
 */
const RUNNING_SUM_SOURCE = `
export default {
    manifest: ${JSON.stringify(manifest())},
    compute: (ctx) => {
        const total = ctx.state.int("sum.chart.ts:1:1#0", 0);
        total.value += ctx.bar.close.current;
        const sma = ctx.ta.sma("sum.chart.ts:2:1#0", ctx.bar.close, 3);
        ctx.plot("sum.chart.ts:3:1#0", total.value + sma.current, {});
    },
};
`;

function compiled(): HostCompiledScript {
    return { moduleSource: RUNNING_SUM_SOURCE, manifest: manifest() };
}

function bar(i: number): Bar {
    const close = 10 + i;
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open: close,
        high: close,
        low: close,
        close,
        volume: 1,
        symbol: "X",
        interval: "1m",
    };
}

function key(overrides: Partial<StateStoreKey> = {}): StateStoreKey {
    return {
        scriptHash: "running-sum",
        compilerVersion: "1.11.0",
        apiVersion: 1,
        capabilitiesHash: "caps",
        symbol: "X",
        mainInterval: "1m",
        requestedIntervals: [],
        ...overrides,
    };
}

/** Boot-only harness: drives `createWorkerBoot` without a host. */
function makeScope(): {
    scope: WorkerBootScope;
    deliver: (msg: HostToWorker) => Promise<void>;
    captured: ReadonlyArray<WorkerToHost>;
    last: () => WorkerToHost;
} {
    let listener: ((ev: MessageEvent<HostToWorker>) => Promise<void> | void) | null = null;
    const captured: Array<WorkerToHost> = [];
    const scope: WorkerBootScope = {
        addEventListener(_type, l) {
            listener = l as (ev: MessageEvent<HostToWorker>) => Promise<void> | void;
        },
        postMessage(msg) {
            captured.push(msg);
        },
    };
    return {
        scope,
        captured,
        deliver: async (msg) => {
            if (listener === null) throw new Error("no listener attached");
            await listener({ data: msg } as MessageEvent<HostToWorker>);
        },
        last: () => {
            const frame = captured[captured.length - 1];
            if (frame === undefined) throw new Error("nothing posted");
            return frame;
        },
    };
}

async function bootWithScript(
    extra: Partial<Extract<HostToWorker, { kind: "load" }>> = {},
): Promise<ReturnType<typeof makeScope>> {
    const harness = makeScope();
    createWorkerBoot(harness.scope);
    await harness.deliver({
        kind: "load",
        compiled: compiled(),
        capabilities: makeCapabilities(),
        limits: LIMITS,
        ...extra,
    });
    expect(harness.last().kind).toBe("loaded");
    return harness;
}

/** Host ↔ boot over a real `MessageChannel`, as in `integration.test.ts`. */
function pair(): { worker: WorkerLike; scope: WorkerBootScope; close: () => void } {
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
    return {
        worker,
        scope,
        close: () => {
            ch.port1.close();
            ch.port2.close();
        },
    };
}

async function plotsOf(
    host: ReturnType<typeof createWorkerHost>,
    bars: ReadonlyArray<Bar>,
): Promise<number[]> {
    const values: number[] = [];
    for (const b of bars) {
        await host.push({ kind: "close", bar: b });
        const emissions = await host.drain();
        for (const plot of emissions.plots) values.push(plot.value);
    }
    return values;
}

describe("worker boot snapshot verbs", () => {
    it("exports a snapshot stamped with the load-time state store key", async () => {
        const harness = await bootWithScript({ stateStoreKey: key() });
        await harness.deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(0) } });
        await harness.deliver({ kind: "exportSnapshot", nonce: 7 });

        const frame = harness.last();
        expect(frame.kind).toBe("snapshot");
        if (frame.kind !== "snapshot") throw new Error("expected a snapshot frame");
        expect(frame.nonce).toBe(7);
        expect(frame.key).toEqual(key());
        expect(frame.snapshot?.barIndex).toBe(0);
    });

    it("exports a null key when the worker was loaded without one", async () => {
        const harness = await bootWithScript();
        await harness.deliver({ kind: "exportSnapshot", nonce: 1 });

        const frame = harness.last();
        if (frame.kind !== "snapshot") throw new Error("expected a snapshot frame");
        expect(frame.key).toBeNull();
        expect(frame.snapshot?.barIndex).toBe(-1);
    });

    it("refuses exportSnapshot before load with a typed error, not fatal", async () => {
        const harness = makeScope();
        createWorkerBoot(harness.scope);
        await harness.deliver({ kind: "exportSnapshot", nonce: 3 });

        expect(harness.last()).toEqual({
            kind: "snapshotError",
            nonce: 3,
            message: "exportSnapshot before load",
        });
    });

    it("refuses importSnapshot before load", async () => {
        const harness = makeScope();
        createWorkerBoot(harness.scope);
        await harness.deliver({
            kind: "importSnapshot",
            nonce: 4,
            snapshot: {} as StateSnapshot,
            key: null,
        });

        expect(harness.last()).toEqual({
            kind: "snapshotError",
            nonce: 4,
            message: "importSnapshot before load",
        });
    });

    it("refuses importSnapshot after the first push", async () => {
        const harness = await bootWithScript();
        await harness.deliver({ kind: "exportSnapshot", nonce: 0 });
        const exported = harness.last();
        if (exported.kind !== "snapshot" || exported.snapshot === null) {
            throw new Error("expected a captured snapshot");
        }
        await harness.deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(0) } });
        await harness.deliver({
            kind: "importSnapshot",
            nonce: 1,
            snapshot: exported.snapshot,
            key: null,
        });

        expect(harness.last()).toEqual({
            kind: "snapshotError",
            nonce: 1,
            message: "importSnapshot after the first push",
        });
    });

    it("refuses a snapshot whose key does not match the worker's", async () => {
        const source = await bootWithScript({ stateStoreKey: key() });
        await source.deliver({ kind: "exportSnapshot", nonce: 0 });
        const exported = source.last();
        if (exported.kind !== "snapshot" || exported.snapshot === null) {
            throw new Error("expected a captured snapshot");
        }

        const target = await bootWithScript({
            stateStoreKey: key({ compilerVersion: "9.9.9" }),
        });
        await target.deliver({
            kind: "importSnapshot",
            nonce: 2,
            snapshot: exported.snapshot,
            key: exported.key,
        });

        expect(target.last()).toEqual({
            kind: "snapshotError",
            nonce: 2,
            message: "importSnapshot state store key mismatch",
        });
    });

    it("refuses a malformed snapshot payload", async () => {
        const harness = await bootWithScript();
        await harness.deliver({
            kind: "importSnapshot",
            nonce: 5,
            snapshot: { snapshotVersion: 1 } as unknown as StateSnapshot,
            key: null,
        });

        const frame = harness.last();
        if (frame.kind !== "snapshotError") throw new Error("expected a snapshotError frame");
        expect(frame.nonce).toBe(5);
        expect(frame.message).toMatch(/failed validation/);
    });

    it("clears the ordering + key state on dispose so a reload starts fresh", async () => {
        const harness = await bootWithScript({ stateStoreKey: key() });
        await harness.deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(0) } });
        await harness.deliver({ kind: "dispose" });
        await harness.deliver({ kind: "exportSnapshot", nonce: 9 });

        expect(harness.last()).toEqual({
            kind: "snapshotError",
            nonce: 9,
            message: "exportSnapshot before load",
        });
    });
});

describe("createWorkerHost snapshot verbs", () => {
    it("round-trips a resumed host against an uninterrupted one", async () => {
        const control = pair();
        createWorkerBoot(control.scope);
        const controlHost = createWorkerHost({
            capabilities: makeCapabilities(),
            workerLike: control.worker,
            stateStoreKey: key(),
        });
        await controlHost.load(compiled());
        const straight = await plotsOf(
            controlHost,
            Array.from({ length: 10 }, (_unused, i) => bar(i)),
        );
        control.close();

        const cold = pair();
        createWorkerBoot(cold.scope);
        const coldHost = createWorkerHost({
            capabilities: makeCapabilities(),
            workerLike: cold.worker,
            stateStoreKey: key(),
        });
        await coldHost.load(compiled());
        const firstLeg = await plotsOf(
            coldHost,
            Array.from({ length: 6 }, (_unused, i) => bar(i)),
        );
        const exported = await coldHost.exportSnapshot();
        expect(exported).not.toBeNull();
        expect(exported?.key).toEqual(key());
        cold.close();

        const warm = pair();
        createWorkerBoot(warm.scope);
        const warmHost = createWorkerHost({
            capabilities: makeCapabilities(),
            workerLike: warm.worker,
            stateStoreKey: key(),
        });
        await warmHost.load(compiled());
        const ack = await warmHost.importSnapshot(exported as HostSnapshot);
        expect(ack).toEqual({ barIndex: 5 });
        const secondLeg = await plotsOf(
            warmHost,
            Array.from({ length: 10 - (ack.barIndex + 1) }, (_unused, i) =>
                bar(ack.barIndex + 1 + i),
            ),
        );
        warm.close();

        expect([...firstLeg, ...secondLeg]).toEqual(straight);
    });

    it("rejects with a SnapshotError when the worker refuses the verb", async () => {
        const { worker, scope, close } = pair();
        createWorkerBoot(scope);
        const host = createWorkerHost({
            capabilities: makeCapabilities(),
            workerLike: worker,
        });

        await expect(host.exportSnapshot()).rejects.toThrow("exportSnapshot before load");
        await host.load(compiled());
        await host.push({ kind: "close", bar: bar(0) });
        const rejection = host
            .importSnapshot({ key: null, snapshot: {} as StateSnapshot })
            .catch((err: unknown) => err);
        const err = await rejection;
        expect(isSnapshotError(err)).toBe(true);
        expect((err as Error).message).toBe("importSnapshot after the first push");
        close();
    });

    it("forwards the snapshot identity and persistence descriptor on load", async () => {
        const sent: Array<HostToWorker> = [];
        const worker: WorkerLike = {
            addEventListener() {},
            postMessage(msg) {
                sent.push(msg as HostToWorker);
            },
        };
        const host = createWorkerHost({
            capabilities: makeCapabilities(),
            workerLike: worker,
            stateStoreKey: key(),
            persistence: { kind: "idb", dbName: "chartlang-host-test" },
        });
        void host.load(compiled());

        const frame = sent[0];
        if (frame?.kind !== "load") throw new Error("expected a load frame");
        expect(frame.stateStoreKey).toEqual(key());
        expect(frame.persistence).toEqual({ kind: "idb", dbName: "chartlang-host-test" });
        host.dispose();
    });

    it("resolves null when the worker captured nothing", async () => {
        const sent: Array<HostToWorker> = [];
        let listener: ((ev: MessageEvent<unknown>) => void) | null = null;
        const worker: WorkerLike = {
            addEventListener(type, l) {
                if (type === "message") listener = l as (ev: MessageEvent<unknown>) => void;
            },
            postMessage(msg) {
                sent.push(msg as HostToWorker);
            },
        };
        const host = createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        const pending = host.exportSnapshot();
        const deliver = (msg: WorkerToHost): void => {
            if (listener === null) throw new Error("no listener attached");
            listener({ data: msg } as MessageEvent<unknown>);
        };
        // A reply for a nonce nobody is waiting on must be dropped, not crash.
        deliver({ kind: "snapshot", nonce: 99, snapshot: null, key: null });
        deliver({ kind: "snapshotImported", nonce: 99, barIndex: 3 });
        deliver({ kind: "snapshotError", nonce: 99, message: "stray" });
        deliver({ kind: "snapshot", nonce: 0, snapshot: null, key: null });

        await expect(pending).resolves.toBeNull();
    });

    it("clears pending snapshot waiters on dispose", async () => {
        const { worker, scope, close } = pair();
        createWorkerBoot(scope);
        const host = createWorkerHost({
            capabilities: makeCapabilities(),
            workerLike: worker,
        });
        await host.load(compiled());
        let settled = false;
        void host.exportSnapshot().then(
            () => {
                settled = true;
            },
            () => {
                settled = true;
            },
        );
        void host.importSnapshot({ key: null, snapshot: {} as StateSnapshot }).then(
            () => {
                settled = true;
            },
            () => {
                settled = true;
            },
        );
        host.dispose();
        await Promise.resolve();
        expect(settled).toBe(false);
        close();
    });
});

describe("worker boot IDB persistence", () => {
    it("saves through the packaged store and warm-starts the next boot from it", async () => {
        const persistedKey = key({ scriptHash: "idb-round-trip" });
        const first = await bootWithScript({
            stateStoreKey: persistedKey,
            persistence: { kind: "idb", dbName: "chartlang-boot-test" },
        });
        for (let i = 0; i < 4; i += 1) {
            await first.deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(i) } });
        }
        // `dispose` performs the runtime's final save into IndexedDB.
        await first.deliver({ kind: "dispose" });

        const second = await bootWithScript({
            stateStoreKey: persistedKey,
            persistence: { kind: "idb", dbName: "chartlang-boot-test" },
        });
        await second.deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(4) } });
        await second.deliver({ kind: "drain", nonce: 0 });

        const frame = second.last();
        if (frame.kind !== "emissions") throw new Error("expected an emissions frame");
        // Bar 4 lands on a runner that already folded bars 0..3, so the running
        // total is the full 10+11+12+13+14 sum plus the sma of 12/13/14 — a
        // cold boot would plot 14 + NaN. (The `state-snapshot-restored`
        // diagnostic is not assertable here: the runtime clears emissions at
        // the start of every bar, and the restore happens before that bar.)
        expect(frame.emissions.plots[0]?.value).toBe(60 + 13);
    });

    it("keeps the warm-start armed until an event carries a bar time", async () => {
        const persistedKey = key({ scriptHash: "idb-empty-history" });
        const seeded = await bootWithScript({
            stateStoreKey: persistedKey,
            persistence: { kind: "idb", dbName: "chartlang-boot-test" },
        });
        for (let i = 0; i < 3; i += 1) {
            await seeded.deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(i) } });
        }
        await seeded.deliver({ kind: "dispose" });

        const warm = await bootWithScript({
            stateStoreKey: persistedKey,
            persistence: { kind: "idb", dbName: "chartlang-boot-test" },
        });
        // An empty history frame carries no bar time — the arm must survive.
        await warm.deliver({ kind: "candleEvent", event: { kind: "history", bars: [] } });
        await warm.deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(3) } });
        await warm.deliver({ kind: "drain", nonce: 0 });

        const frame = warm.last();
        if (frame.kind !== "emissions") throw new Error("expected an emissions frame");
        // 10+11+12+13 running total plus sma(11,12,13) — the restore survived
        // the bar-time-less frame.
        expect(frame.emissions.plots[0]?.value).toBe(46 + 12);
    });

    it("re-seeds harmlessly when the consumer pushes full history over a restore", async () => {
        const persistedKey = key({ scriptHash: "idb-full-history" });
        const seeded = await bootWithScript({
            stateStoreKey: persistedKey,
            persistence: { kind: "idb", dbName: "chartlang-boot-test" },
        });
        for (let i = 0; i < 3; i += 1) {
            await seeded.deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(i) } });
        }
        await seeded.deliver({ kind: "dispose" });

        const bars = Array.from({ length: 4 }, (_unused, i) => bar(i));
        const cold = await bootWithScript();
        await cold.deliver({ kind: "candleEvent", event: { kind: "history", bars } });
        await cold.deliver({ kind: "drain", nonce: 0 });
        const coldFrame = cold.last();
        if (coldFrame.kind !== "emissions") throw new Error("expected an emissions frame");

        const warm = await bootWithScript({
            stateStoreKey: persistedKey,
            persistence: { kind: "idb", dbName: "chartlang-boot-test" },
        });
        // The warm start restores, then the overlapping history re-seeds the
        // runner from bar 0 — the restore is discarded, never doubled.
        await warm.deliver({ kind: "candleEvent", event: { kind: "history", bars } });
        await warm.deliver({ kind: "drain", nonce: 0 });
        const warmFrame = warm.last();
        if (warmFrame.kind !== "emissions") throw new Error("expected an emissions frame");

        expect(warmFrame.emissions.plots.map((p) => p.value)).toEqual(
            coldFrame.emissions.plots.map((p) => p.value),
        );
    });

    it("ignores a persistence descriptor with no state store key", async () => {
        const harness = await bootWithScript({ persistence: { kind: "idb" } });
        await harness.deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(0) } });
        await harness.deliver({ kind: "drain", nonce: 0 });

        const frame = harness.last();
        if (frame.kind !== "emissions") throw new Error("expected an emissions frame");
        expect(frame.emissions.diagnostics).toEqual([]);
    });

    it("honours an explicit capBytes cap", async () => {
        const harness = await bootWithScript({
            stateStoreKey: key({ scriptHash: "idb-cap" }),
            persistence: { kind: "idb", dbName: "chartlang-boot-test", capBytes: 1_000_000 },
        });
        await harness.deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(0) } });
        await harness.deliver({ kind: "dispose" });
        expect(harness.captured.some((f) => f.kind === "fatal")).toBe(false);
    });

    it("falls back to the store's own defaults when the descriptor omits them", async () => {
        const harness = await bootWithScript({
            stateStoreKey: key({ scriptHash: "idb-defaults" }),
            persistence: { kind: "idb" },
        });
        await harness.deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(0) } });
        await harness.deliver({ kind: "dispose" });
        expect(harness.captured.some((f) => f.kind === "fatal")).toBe(false);
    });
});
