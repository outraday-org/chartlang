// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities, RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";
import type { ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, it, vi } from "vitest";

import { createWorkerHost } from "./createWorkerHost.js";
import { DEFAULT_LIMITS } from "./limits.js";
import type { HostToWorker, WorkerToHost } from "./protocol.js";
import type { HostCompiledScript, WorkerErrorEvent, WorkerLike } from "./types.js";

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
        alertConditions: [],
        logs: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
}

type FakeWorker = WorkerLike & {
    readonly sent: ReadonlyArray<HostToWorker>;
    readonly terminateMock: ReturnType<typeof vi.fn>;
    deliver(msg: WorkerToHost): void;
    deliverError(ev: WorkerErrorEvent): void;
    readonly hasErrorListener: () => boolean;
};

type FakeOpts = {
    readonly withTerminate?: boolean;
    /** Drop "error" subscriptions to simulate a `MessagePort`-backed fake. */
    readonly withErrorSupport?: boolean;
};

function makeFakeWorker(opts?: FakeOpts): FakeWorker {
    const sent: Array<HostToWorker> = [];
    let messageListener: ((ev: MessageEvent<unknown>) => void) | null = null;
    let errorListener: ((ev: WorkerErrorEvent) => void) | null = null;
    const terminateMock = vi.fn<() => void>();
    const errorSupport = opts?.withErrorSupport !== false;
    const w: WorkerLike = {
        addEventListener(type: "message" | "error", l: unknown) {
            if (type === "message") {
                messageListener = l as (ev: MessageEvent<unknown>) => void;
                return;
            }
            if (errorSupport) {
                errorListener = l as (ev: WorkerErrorEvent) => void;
            }
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
            if (messageListener === null) throw new Error("no listener attached");
            messageListener({ data: msg } as MessageEvent<unknown>);
        },
        deliverError(ev: WorkerErrorEvent) {
            if (errorListener === null) throw new Error("no error listener attached");
            errorListener(ev);
        },
        hasErrorListener() {
            return errorListener !== null;
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

    it("exposes maxLoadTimeoutMs through the merged limits", () => {
        const worker = makeFakeWorker();
        const host = createWorkerHost({
            capabilities: makeCapabilities(),
            workerLike: worker,
            limits: { maxLoadTimeoutMs: 7_500 },
        });
        expect(host.limits.maxLoadTimeoutMs).toBe(7_500);
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

    it("posts the load frame with capabilities, sym-info, input/plot overrides, and merged limits", async () => {
        const worker = makeFakeWorker();
        const caps = makeCapabilities();
        const symInfo = { ticker: "DEMO" };
        const resolveInputs = vi.fn((scriptId: string) => ({ length: scriptId.length }));
        const resolvePlotOverrides = vi.fn((_scriptId: string) => ({
            "p:1:1#0": { visible: false },
        }));
        const host = createWorkerHost({
            capabilities: caps,
            symInfo,
            resolveInputs,
            resolvePlotOverrides,
            workerLike: worker,
            limits: { maxRingBufferBars: 999 },
        });
        const p = host.load(emptyCompiled());
        const frame = worker.sent[0];
        if (frame.kind !== "load") throw new Error("expected load frame");
        expect(frame.capabilities).toBe(caps);
        expect(frame.symInfo).toBe(symInfo);
        expect(frame.inputOverrides).toEqual({ length: 4 });
        expect(frame.plotOverrides).toEqual({ "p:1:1#0": { visible: false } });
        expect(frame.limits.maxRingBufferBars).toBe(999);
        expect(frame.compiled.manifest.name).toBe("demo");
        expect(resolveInputs).toHaveBeenCalledWith("demo");
        expect(resolvePlotOverrides).toHaveBeenCalledWith("demo");
        worker.deliver({ kind: "loaded" });
        await p;
    });

    it("omits plotOverrides on the load frame when resolvePlotOverrides is not supplied", async () => {
        const worker = makeFakeWorker();
        const host = createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        const p = host.load(emptyCompiled());
        const frame = worker.sent[0];
        if (frame.kind !== "load") throw new Error("expected load frame");
        expect("plotOverrides" in frame).toBe(false);
        worker.deliver({ kind: "loaded" });
        await p;
    });

    it("posts a setPlotOverrides frame for host.setPlotOverrides(...)", () => {
        const worker = makeFakeWorker();
        const host = createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        host.setPlotOverrides({ "p:1:1#0": { color: "#f00" } });
        const last = worker.sent[worker.sent.length - 1];
        if (last.kind !== "setPlotOverrides") throw new Error("expected setPlotOverrides");
        expect(last.overrides).toEqual({ "p:1:1#0": { color: "#f00" } });
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

    it("subscribes to the worker's error event when the WorkerLike supports it", () => {
        const worker = makeFakeWorker();
        createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        expect(worker.hasErrorListener()).toBe(true);
    });

    it("rejects an in-flight load() when the worker fires an error event", async () => {
        const worker = makeFakeWorker();
        const onWorkerError = vi.fn<(m: string) => void>();
        const host = createWorkerHost({
            capabilities: makeCapabilities(),
            workerLike: worker,
            onWorkerError,
        });
        const p = host.load(emptyCompiled());
        worker.deliverError({ message: "worker-boot.js 404" });
        await expect(p).rejects.toThrow("worker failed to boot: worker-boot.js 404");
        expect(onWorkerError).toHaveBeenCalledWith("worker failed to boot: worker-boot.js 404");
    });

    it("rejects a subsequent load() after the worker has already errored", async () => {
        const worker = makeFakeWorker();
        const host = createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        worker.deliverError({ message: "import failed" });
        await expect(host.load(emptyCompiled())).rejects.toThrow(
            "worker failed to boot: import failed",
        );
    });

    it("extracts the boot error message from ev.error when ev.message is empty", async () => {
        const worker = makeFakeWorker();
        const host = createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        const p = host.load(emptyCompiled());
        worker.deliverError({ error: new Error("ctor exploded") });
        await expect(p).rejects.toThrow("worker failed to boot: ctor exploded");
    });

    it("extracts the boot error message from a string ev.error", async () => {
        const worker = makeFakeWorker();
        const host = createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        const p = host.load(emptyCompiled());
        worker.deliverError({ error: "plain string failure" });
        await expect(p).rejects.toThrow("worker failed to boot: plain string failure");
    });

    it("falls back to a generic message when the error event carries no description", async () => {
        const worker = makeFakeWorker();
        const host = createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        const p = host.load(emptyCompiled());
        worker.deliverError({});
        await expect(p).rejects.toThrow("worker failed to boot: unknown worker error");
    });

    it("rejects load() when the worker never replies within maxLoadTimeoutMs", async () => {
        vi.useFakeTimers();
        try {
            const worker = makeFakeWorker();
            const host = createWorkerHost({
                capabilities: makeCapabilities(),
                workerLike: worker,
                limits: { maxLoadTimeoutMs: 25 },
            });
            const p = host.load(emptyCompiled());
            const expectation = expect(p).rejects.toThrow(
                "worker load() timed out after 25ms — worker never replied with 'loaded'",
            );
            await vi.advanceTimersByTimeAsync(25);
            await expectation;
        } finally {
            vi.useRealTimers();
        }
    });

    it("clears the load timeout when the worker replies before it fires", async () => {
        vi.useFakeTimers();
        try {
            const worker = makeFakeWorker();
            const host = createWorkerHost({
                capabilities: makeCapabilities(),
                workerLike: worker,
                limits: { maxLoadTimeoutMs: 25 },
            });
            const p = host.load(emptyCompiled());
            worker.deliver({ kind: "loaded" });
            await p;
            // Advance past the original timeout. If the timer wasn't cleared,
            // it would fire and surface as an unhandled rejection — vitest
            // would surface the leak loudly here.
            await vi.advanceTimersByTimeAsync(50);
        } finally {
            vi.useRealTimers();
        }
    });

    it("clears the load timeout on dispose() so it can't fire later", async () => {
        vi.useFakeTimers();
        try {
            const worker = makeFakeWorker();
            const host = createWorkerHost({
                capabilities: makeCapabilities(),
                workerLike: worker,
                limits: { maxLoadTimeoutMs: 25 },
            });
            // Kick off load() so a timeout is armed, then dispose without
            // replying. Advance past the deadline — the timeout must not
            // surface a rejection because dispose cleared it.
            const p = host.load(emptyCompiled());
            // Swallow the reject the consumer must own. We're verifying
            // there is no rogue timer firing; rejection during dispose is
            // out of scope for this assertion.
            p.catch(() => undefined);
            host.dispose();
            await vi.advanceTimersByTimeAsync(50);
        } finally {
            vi.useRealTimers();
        }
    });

    it("works with a WorkerLike that does not support error events", async () => {
        const worker = makeFakeWorker({ withErrorSupport: false });
        const host = createWorkerHost({ capabilities: makeCapabilities(), workerLike: worker });
        expect(worker.hasErrorListener()).toBe(false);
        const p = host.load(emptyCompiled());
        worker.deliver({ kind: "loaded" });
        await expect(p).resolves.toBeUndefined();
    });
});
