// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities, RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";
import type { ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, it, vi } from "vitest";

import { createWorkerHost } from "./createWorkerHost";
import { DEFAULT_LIMITS } from "./limits";
import type { HostToWorker, WorkerToHost } from "./protocol";
import type { HostCompiledScript, WorkerLike } from "./types";

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

function emptyManifest(): ScriptManifest {
    return {
        apiVersion: 1,
        kind: "indicator",
        name: "demo",
        inputs: {},
        capabilities: ["indicators"],
        requestedIntervals: [],
        userPickableInterval: false,
        seriesCapacities: {},
        maxLookback: 0,
    };
}

function emptyCompiled(): HostCompiledScript {
    return { moduleSource: "export default {};", manifest: emptyManifest() };
}

function emptyEmissions(): RunnerEmissions {
    return {
        plots: [],
        drawings: [],
        alerts: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
}

type FakeWorker = WorkerLike & {
    readonly sent: ReadonlyArray<HostToWorker>;
    readonly terminateMock: ReturnType<typeof vi.fn>;
    deliver(msg: WorkerToHost): void;
};

function makeFakeWorker(opts?: { withTerminate?: boolean }): FakeWorker {
    const sent: Array<HostToWorker> = [];
    let listener: ((ev: MessageEvent<unknown>) => void) | null = null;
    const terminateMock = vi.fn<() => void>();
    const w: WorkerLike = {
        addEventListener(_type, l) {
            listener = l;
        },
        postMessage(msg) {
            sent.push(msg as HostToWorker);
        },
        ...(opts?.withTerminate !== false ? { terminate: terminateMock } : {}),
    };
    return Object.assign(w, {
        get sent(): ReadonlyArray<HostToWorker> {
            return sent;
        },
        terminateMock,
        deliver(msg: WorkerToHost) {
            if (listener === null) throw new Error("no listener attached");
            listener({ data: msg } as MessageEvent<unknown>);
        },
    });
}

describe("createWorkerHost", () => {
    it("defaults limits to DEFAULT_LIMITS when opts.limits omitted", () => {
        const worker = makeFakeWorker();
        const host = createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        expect(host.limits).toEqual(DEFAULT_LIMITS);
    });

    it("merges partial limits over DEFAULT_LIMITS", () => {
        const worker = makeFakeWorker();
        const host = createWorkerHost({
            capabilities: makeCapabilities(),
            workerLike: worker,
            limits: { maxCpuMsPerStep: 200 },
        });
        expect(host.limits).toEqual({
            ...DEFAULT_LIMITS,
            maxCpuMsPerStep: 200,
        });
    });

    it("resolves load() when the worker posts 'loaded'", async () => {
        const worker = makeFakeWorker();
        const host = createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        const p = host.load(emptyCompiled());
        const sent = worker.sent[0];
        expect(sent.kind).toBe("load");
        worker.deliver({ kind: "loaded" });
        await expect(p).resolves.toBeUndefined();
    });

    it("posts the load frame with capabilities, sym-info, input overrides, and merged limits", async () => {
        const worker = makeFakeWorker();
        const caps = makeCapabilities();
        const symInfo = { ticker: "DEMO" };
        const resolveInputs = vi.fn((scriptId: string) => ({ length: scriptId.length }));
        const host = createWorkerHost({
            capabilities: caps,
            symInfo,
            resolveInputs,
            workerLike: worker,
            limits: { maxRingBufferBars: 999 },
        });
        const p = host.load(emptyCompiled());
        const frame = worker.sent[0];
        if (frame.kind !== "load") throw new Error("expected load frame");
        expect(frame.capabilities).toBe(caps);
        expect(frame.symInfo).toBe(symInfo);
        expect(frame.inputOverrides).toEqual({ length: 4 });
        expect(frame.limits.maxRingBufferBars).toBe(999);
        expect(frame.compiled.manifest.name).toBe("demo");
        expect(resolveInputs).toHaveBeenCalledWith("demo");
        worker.deliver({ kind: "loaded" });
        await p;
    });

    it("rejects a second load() while the first is still in flight", async () => {
        const worker = makeFakeWorker();
        const host = createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        const first = host.load(emptyCompiled());
        const second = host.load(emptyCompiled());
        await expect(second).rejects.toThrow("load() already in flight");
        worker.deliver({ kind: "loaded" });
        await expect(first).resolves.toBeUndefined();
    });

    it("rejects load() when the worker posts 'loadError'", async () => {
        const worker = makeFakeWorker();
        const host = createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        const p = host.load(emptyCompiled());
        worker.deliver({ kind: "loadError", message: "import failed" });
        await expect(p).rejects.toThrow("import failed");
    });

    it("forwards push() events verbatim as candleEvent frames", async () => {
        const worker = makeFakeWorker();
        const host = createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        await host.push({ kind: "history", bars: [] });
        const frame = worker.sent[0];
        if (frame.kind !== "candleEvent") throw new Error("expected candleEvent");
        expect(frame.event.kind).toBe("history");
    });

    it("round-trips drain() with matching nonce", async () => {
        const worker = makeFakeWorker();
        const host = createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        const p = host.drain();
        const frame = worker.sent[0];
        if (frame.kind !== "drain") throw new Error("expected drain");
        const emissions = emptyEmissions();
        worker.deliver({ kind: "emissions", nonce: frame.nonce, emissions });
        await expect(p).resolves.toBe(emissions);
    });

    it("interleaves multiple drains by nonce", async () => {
        const worker = makeFakeWorker();
        const host = createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        const a = host.drain();
        const b = host.drain();
        const nonces = worker.sent.map((m) => (m.kind === "drain" ? m.nonce : -1));
        const eA = emptyEmissions();
        const eB = { ...emptyEmissions(), fromBar: 7 };
        worker.deliver({ kind: "emissions", nonce: nonces[1], emissions: eB });
        worker.deliver({ kind: "emissions", nonce: nonces[0], emissions: eA });
        await expect(a).resolves.toBe(eA);
        await expect(b).resolves.toBe(eB);
    });

    it("ignores emissions for unknown nonces", () => {
        const worker = makeFakeWorker();
        const host = createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        // Should not throw, no pending drain at this nonce.
        expect(() =>
            worker.deliver({ kind: "emissions", nonce: 42, emissions: emptyEmissions() }),
        ).not.toThrow();
        host.dispose();
    });

    it("dispose() posts a dispose frame and terminates when supported", () => {
        const worker = makeFakeWorker();
        const host = createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        host.dispose();
        const last = worker.sent[worker.sent.length - 1];
        expect(last.kind).toBe("dispose");
        expect(worker.terminateMock).toHaveBeenCalledOnce();
    });

    it("dispose() works when the WorkerLike has no terminate", () => {
        const worker = makeFakeWorker({ withTerminate: false });
        const host = createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        expect(() => host.dispose()).not.toThrow();
    });

    it("dispose() clears pending drains", async () => {
        const worker = makeFakeWorker();
        const host = createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        const p = host.drain();
        host.dispose();
        // Deliver after dispose — the drain stays pending (drained from map).
        const drainFrame = worker.sent[0];
        if (drainFrame.kind !== "drain") throw new Error("expected drain");
        worker.deliver({
            kind: "emissions",
            nonce: drainFrame.nonce,
            emissions: emptyEmissions(),
        });
        // Race against a timeout — the drain must not resolve.
        const race = await Promise.race([
            p.then(() => "resolved"),
            new Promise<string>((r) => setTimeout(() => r("pending"), 30)),
        ]);
        expect(race).toBe("pending");
    });

    it("calls onWorkerError on step-overshoot", () => {
        const worker = makeFakeWorker();
        const onWorkerError = vi.fn<(m: string) => void>();
        createWorkerHost({
            capabilities: makeCapabilities(),
            workerLike: worker,
            onWorkerError,
        });
        worker.deliver({ kind: "step-overshoot", observedMs: 123.456 });
        expect(onWorkerError).toHaveBeenCalledWith("step overshoot 123.46ms");
    });

    it("calls onWorkerError on fatal", () => {
        const worker = makeFakeWorker();
        const onWorkerError = vi.fn<(m: string) => void>();
        createWorkerHost({
            capabilities: makeCapabilities(),
            workerLike: worker,
            onWorkerError,
        });
        worker.deliver({ kind: "fatal", message: "kaput" });
        expect(onWorkerError).toHaveBeenCalledWith("kaput");
    });

    it("does not crash when onWorkerError is omitted", () => {
        const worker = makeFakeWorker();
        createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        expect(() => worker.deliver({ kind: "fatal", message: "x" })).not.toThrow();
        expect(() => worker.deliver({ kind: "step-overshoot", observedMs: 1 })).not.toThrow();
    });

    it("freezes the returned ScriptHost", () => {
        const worker = makeFakeWorker();
        const host = createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        expect(Object.isFrozen(host)).toBe(true);
    });
});
