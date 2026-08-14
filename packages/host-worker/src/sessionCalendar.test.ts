// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, ScriptManifest, SessionCalendarDay } from "@invinite-org/chartlang-core";
import { describe, expect, it, vi } from "vitest";

import { type WorkerBootScope, createWorkerBoot } from "./createWorkerBoot.js";
import { createWorkerHost } from "./createWorkerHost.js";
import type { HostToWorker, WorkerToHost } from "./protocol.js";
import type { HostCompiledScript, HostLimits, WorkerLike } from "./types.js";

// 2024-11-29 is the Black Friday half day: the exchange closes at 13:00, so a
// 15:00 bar is INSIDE the nominal 09:30-16:00 window but outside the real one.
const HALF_DAY: ReadonlyArray<SessionCalendarDay> = [
    { dayKey: "2024-11-29", kind: "halfDay", closeMinutes: 13 * 60 },
];
const AFTER_EARLY_CLOSE = Date.UTC(2024, 10, 29, 15, 0, 0);

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
        name: "demo",
        inputs: {},
        capabilities: ["indicators"],
        requestedIntervals: [],
        userPickableInterval: false,
        seriesCapacities: { ohlcv: 4 },
        maxLookback: 0,
    };
}

// Throwing on an OPEN session turns the calendar answer into an observable
// protocol frame: a `fatal` reply means the script saw the session as open.
const THROW_WHEN_OPEN_SOURCE = `
export default {
    manifest: ${JSON.stringify(manifest())},
    compute: (ctx) => {
        if (ctx.session.isOpen(ctx.bar.time, "0930-1600")) throw new Error("session open");
    },
};
`;

function bar(time: number): Bar {
    return {
        time,
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        volume: 0,
        symbol: "X",
        interval: "1h",
    };
}

function makeScope(): {
    scope: WorkerBootScope;
    deliver: (msg: HostToWorker) => Promise<void>;
    captured: ReadonlyArray<WorkerToHost>;
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
    };
}

async function pushOneBar(
    sessionCalendar?: ReadonlyArray<SessionCalendarDay>,
): Promise<ReadonlyArray<WorkerToHost>> {
    const { scope, deliver, captured } = makeScope();
    createWorkerBoot(scope);
    await deliver({
        kind: "load",
        compiled: { moduleSource: THROW_WHEN_OPEN_SOURCE, manifest: manifest() },
        capabilities: makeCapabilities(),
        ...(sessionCalendar === undefined ? {} : { sessionCalendar }),
        limits: LIMITS,
    });
    await deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(AFTER_EARLY_CLOSE) } });
    return captured;
}

describe("createWorkerBoot — sessionCalendar", () => {
    it("hands the load frame's rows to the runner, so the script sees the early close", async () => {
        const captured = await pushOneBar(HALF_DAY);
        expect(captured.map((f) => f.kind)).toEqual(["loaded"]);
    });

    it("leaves the session untruncated when the frame carries no rows", async () => {
        const captured = await pushOneBar();
        expect(captured.map((f) => f.kind)).toEqual(["loaded", "fatal"]);
    });
});

type FakeWorker = WorkerLike & { readonly sent: ReadonlyArray<HostToWorker> };

function makeFakeWorker(): FakeWorker {
    const sent: Array<HostToWorker> = [];
    const w: WorkerLike = {
        addEventListener(_type: "message" | "error", _l: unknown) {
            // The host only reads replies in these tests; nothing to deliver.
            void _l;
        },
        postMessage(msg) {
            sent.push(msg as HostToWorker);
        },
        terminate: vi.fn<() => void>(),
    };
    return Object.assign(w, {
        get sent(): ReadonlyArray<HostToWorker> {
            return sent;
        },
    });
}

function emptyCompiled(): HostCompiledScript {
    return { moduleSource: "export default {};", manifest: manifest() };
}

function loadFrameOf(worker: FakeWorker): Extract<HostToWorker, { kind: "load" }> {
    const frame = worker.sent[0];
    if (frame === undefined || frame.kind !== "load") throw new Error("no load frame posted");
    return frame;
}

describe("createWorkerHost — sessionCalendar", () => {
    it("forwards the option onto the load frame", () => {
        const worker = makeFakeWorker();
        const host = createWorkerHost({
            capabilities: makeCapabilities(),
            workerLike: worker,
            sessionCalendar: HALF_DAY,
        });
        void host.load(emptyCompiled());
        expect(loadFrameOf(worker).sessionCalendar).toEqual(HALF_DAY);
    });

    it("omits the field entirely when the option is absent", () => {
        const worker = makeFakeWorker();
        const host = createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        void host.load(emptyCompiled());
        expect("sessionCalendar" in loadFrameOf(worker)).toBe(false);
    });
});
