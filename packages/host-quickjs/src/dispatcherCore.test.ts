// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities as capsHelpers } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities, RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";
import type { CompiledScriptObject, ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, it, vi } from "vitest";

import { createDispatcher, type DispatcherDeps } from "./dispatcherCore.js";
import type { HostToQuickJs } from "./protocol.js";

function makeManifest(): ScriptManifest {
    return {
        apiVersion: 1,
        kind: "indicator",
        name: "core-test",
        inputs: {},
        capabilities: ["indicators"],
        requestedIntervals: [],
        userPickableInterval: false,
        seriesCapacities: { ohlcv: 8 },
        maxLookback: 0,
    };
}

function makeCapabilities(): Capabilities {
    return {
        plots: capsHelpers.allLines(),
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
        maxLookback: 64,
        maxTickHz: 10,
    };
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

function compiledSource(): string {
    return `
export default {
    manifest: ${JSON.stringify(makeManifest())},
    compute: () => {},
};
`;
}

type FakeRunner = {
    push: ReturnType<typeof vi.fn>;
    drain: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    onHistory: ReturnType<typeof vi.fn>;
    onBarClose: ReturnType<typeof vi.fn>;
    onBarTick: ReturnType<typeof vi.fn>;
    warmStart: ReturnType<typeof vi.fn>;
};

function makeFakeRunner(opts?: {
    pushThrow?: Error;
    drainThrow?: Error;
    disposeThrow?: Error;
    emissions?: RunnerEmissions;
}): FakeRunner {
    return {
        push: vi.fn(async () => {
            if (opts?.pushThrow !== undefined) throw opts.pushThrow;
        }),
        drain: vi.fn(() => {
            if (opts?.drainThrow !== undefined) throw opts.drainThrow;
            return opts?.emissions ?? emptyEmissions();
        }),
        dispose: vi.fn(async () => {
            if (opts?.disposeThrow !== undefined) throw opts.disposeThrow;
        }),
        onHistory: vi.fn(async () => {}),
        onBarClose: vi.fn(async () => {}),
        onBarTick: vi.fn(async () => {}),
        warmStart: vi.fn(async () => {}),
    };
}

type Slot = { value: CompiledScriptObject | undefined };

function makeDeps(opts?: {
    slot?: Slot;
    runner?: FakeRunner;
    loadEvalThrow?: Error;
    skipSetDefault?: boolean;
}): {
    deps: DispatcherDeps;
    runner: FakeRunner;
    slot: Slot;
    loadEval: ReturnType<typeof vi.fn>;
    runnerFactory: ReturnType<typeof vi.fn>;
} {
    const slot: Slot = opts?.slot ?? { value: undefined };
    const runner = opts?.runner ?? makeFakeRunner();
    const compiledStub: CompiledScriptObject = {
        manifest: makeManifest(),
        compute: () => {},
    };
    const loadEval = vi.fn((_source: string) => {
        if (opts?.loadEvalThrow !== undefined) throw opts.loadEvalThrow;
        if (!opts?.skipSetDefault) {
            slot.value = compiledStub;
        }
        return undefined;
    });
    const runnerFactory = vi.fn(
        () => runner as unknown as ReturnType<DispatcherDeps["runnerFactory"]>,
    );
    const deps: DispatcherDeps = {
        loadEval,
        runnerFactory: runnerFactory as unknown as DispatcherDeps["runnerFactory"],
        getCompiledDefault: () => slot.value,
        setCompiledDefault: (v) => {
            slot.value = v;
        },
    };
    return { deps, runner, slot, loadEval, runnerFactory };
}

function loadFrame(extra: Partial<Extract<HostToQuickJs, { kind: "load" }>> = {}): string {
    const frame: HostToQuickJs = {
        kind: "load",
        compiled: { moduleSource: compiledSource(), manifest: makeManifest() },
        capabilities: makeCapabilities(),
        limits: { maxHeapBytes: 1024, maxStepMs: 10 },
        ...extra,
    };
    return JSON.stringify(frame);
}

function drainFrame(nonce = 7): string {
    return JSON.stringify({ kind: "drain", nonce } as HostToQuickJs);
}

function pushFrame(): string {
    return JSON.stringify({
        kind: "candleEvent",
        event: { kind: "history", bars: [] },
    } as HostToQuickJs);
}

describe("createDispatcher", () => {
    it("returns frozen handlers", () => {
        const { deps } = makeDeps();
        const handlers = createDispatcher(deps);
        expect(Object.isFrozen(handlers)).toBe(true);
        expect(typeof handlers.load).toBe("function");
        expect(typeof handlers.push).toBe("function");
        expect(typeof handlers.drain).toBe("function");
        expect(typeof handlers.dispose).toBe("function");
    });

    describe("load", () => {
        it("replies with `loaded` when the runner constructs successfully", async () => {
            const { deps, loadEval, runnerFactory, slot } = makeDeps();
            const handlers = createDispatcher(deps);
            const replyJson = await handlers.load(loadFrame());
            expect(JSON.parse(replyJson)).toEqual({ kind: "loaded" });
            expect(loadEval).toHaveBeenCalledOnce();
            // setCompiledDefault is called once with undefined (reset) and the eval populates it.
            expect(slot.value).toBeDefined();
            expect(runnerFactory).toHaveBeenCalledOnce();
            const args = runnerFactory.mock.calls[0][0] as Parameters<
                DispatcherDeps["runnerFactory"]
            >[0];
            expect(args.compiled).toBe(slot.value);
            expect(args.capabilities.plots).toBeInstanceOf(Set);
            expect("symInfo" in args).toBe(false);
            expect("inputOverrides" in args).toBe(false);
        });

        it("revives array-shaped capability collections back into Sets", async () => {
            const { deps, runnerFactory } = makeDeps();
            const handlers = createDispatcher(deps);
            // The real `createQuickJsHost` stringifies Sets to arrays via a JSON
            // replacer; emulate that on-wire shape here to exercise the
            // array-branch of `reviveSet`.
            const raw = JSON.parse(loadFrame()) as { capabilities: Capabilities };
            raw.capabilities = {
                ...raw.capabilities,
                plots: ["line.thin"] as unknown as ReadonlySet<string>,
                drawings: ["box"] as unknown as ReadonlySet<string>,
                alerts: ["a1"] as unknown as ReadonlySet<string>,
                inputs: ["i1"] as unknown as ReadonlySet<string>,
                symInfoFields: ["ticker"] as unknown as ReadonlySet<string>,
            };
            const reply = await handlers.load(JSON.stringify(raw));
            expect(JSON.parse(reply).kind).toBe("loaded");
            const caps = (runnerFactory.mock.calls[0][0] as { capabilities: Capabilities })
                .capabilities;
            expect(caps.plots).toBeInstanceOf(Set);
            expect([...caps.plots]).toEqual(["line.thin"]);
            expect([...caps.drawings]).toEqual(["box"]);
            expect([...caps.alerts]).toEqual(["a1"]);
            expect([...caps.inputs]).toEqual(["i1"]);
            expect([...caps.symInfoFields]).toEqual(["ticker"]);
        });

        it("forwards optional symInfo and inputOverrides into the runner factory", async () => {
            const { deps, runnerFactory } = makeDeps();
            const handlers = createDispatcher(deps);
            const reply = await handlers.load(
                loadFrame({ symInfo: { ticker: "X" }, inputOverrides: { len: 5 } }),
            );
            expect(JSON.parse(reply).kind).toBe("loaded");
            const args = runnerFactory.mock.calls[0][0] as Parameters<
                DispatcherDeps["runnerFactory"]
            >[0];
            expect(args.symInfo).toEqual({ ticker: "X" });
            expect(args.inputOverrides).toEqual({ len: 5 });
        });

        it("revives non-array capability collections into empty Sets", async () => {
            const { deps, runnerFactory } = makeDeps();
            const handlers = createDispatcher(deps);
            // Capabilities arrive as JSON-serialised arrays; pass a raw object whose
            // collections are NOT arrays to exercise the reviveSet fallback branch.
            const malformed = JSON.parse(loadFrame()) as { capabilities: Capabilities };
            malformed.capabilities = {
                ...malformed.capabilities,
                plots: "nope" as unknown as ReadonlySet<string>,
                drawings: null as unknown as ReadonlySet<string>,
                alerts: undefined as unknown as ReadonlySet<string>,
                inputs: 42 as unknown as ReadonlySet<string>,
                symInfoFields: {} as unknown as ReadonlySet<string>,
            };
            const reply = await handlers.load(JSON.stringify(malformed));
            expect(JSON.parse(reply).kind).toBe("loaded");
            const caps = (runnerFactory.mock.calls[0][0] as { capabilities: Capabilities })
                .capabilities;
            expect(caps.plots).toBeInstanceOf(Set);
            expect([...caps.plots]).toEqual([]);
            expect([...caps.drawings]).toEqual([]);
            expect([...caps.alerts]).toEqual([]);
            expect([...caps.inputs]).toEqual([]);
            expect([...caps.symInfoFields]).toEqual([]);
        });

        it("replies with `loadError` when the compiled module fails to set a default export", async () => {
            const { deps } = makeDeps({ skipSetDefault: true });
            const handlers = createDispatcher(deps);
            const reply = JSON.parse(await handlers.load(loadFrame()));
            expect(reply).toEqual({
                kind: "loadError",
                message: "compiled module did not set a default export",
            });
        });

        it("replies with `loadError` when loadEval throws an Error", async () => {
            const { deps } = makeDeps({ loadEvalThrow: new Error("eval blew up") });
            const handlers = createDispatcher(deps);
            const reply = JSON.parse(await handlers.load(loadFrame()));
            expect(reply).toEqual({ kind: "loadError", message: "eval blew up" });
        });

        it("coerces non-Error throws to a string in `loadError`", async () => {
            const slot: Slot = { value: undefined };
            const runner = makeFakeRunner();
            const loadEval = vi.fn(() => {
                throw "stringy boom";
            });
            const deps: DispatcherDeps = {
                loadEval,
                runnerFactory: (() => runner) as unknown as DispatcherDeps["runnerFactory"],
                getCompiledDefault: () => slot.value,
                setCompiledDefault: (v) => {
                    slot.value = v;
                },
            };
            const handlers = createDispatcher(deps);
            const reply = JSON.parse(await handlers.load(loadFrame()));
            expect(reply).toEqual({ kind: "loadError", message: "stringy boom" });
        });
    });

    describe("push", () => {
        it("replies with `fatal` before load", async () => {
            const { deps } = makeDeps();
            const handlers = createDispatcher(deps);
            const reply = JSON.parse(await handlers.push(pushFrame()));
            expect(reply).toEqual({ kind: "fatal", message: "candleEvent before load" });
        });

        it("forwards the parsed event to runner.push and replies with `ack`", async () => {
            const { deps, runner } = makeDeps();
            const handlers = createDispatcher(deps);
            await handlers.load(loadFrame());
            const reply = JSON.parse(await handlers.push(pushFrame()));
            expect(reply).toEqual({ kind: "ack" });
            expect(runner.push).toHaveBeenCalledWith({ kind: "history", bars: [] });
        });

        it("replies with `fatal` when runner.push rejects", async () => {
            const runner = makeFakeRunner({ pushThrow: new Error("push boom") });
            const { deps } = makeDeps({ runner });
            const handlers = createDispatcher(deps);
            await handlers.load(loadFrame());
            const reply = JSON.parse(await handlers.push(pushFrame()));
            expect(reply).toEqual({ kind: "fatal", message: "push boom" });
        });
    });

    describe("drain", () => {
        it("replies with `fatal` before load", () => {
            const { deps } = makeDeps();
            const handlers = createDispatcher(deps);
            const reply = JSON.parse(handlers.drain(drainFrame(3)));
            expect(reply).toEqual({ kind: "fatal", message: "drain before load" });
        });

        it("echoes the nonce and the runner's emissions snapshot", async () => {
            const emissions: RunnerEmissions = { ...emptyEmissions(), fromBar: 5, toBar: 7 };
            const runner = makeFakeRunner({ emissions });
            const { deps } = makeDeps({ runner });
            const handlers = createDispatcher(deps);
            await handlers.load(loadFrame());
            const reply = JSON.parse(handlers.drain(drainFrame(11)));
            expect(reply).toEqual({ kind: "emissions", nonce: 11, emissions });
        });

        it("replies with `fatal` when runner.drain throws", async () => {
            const runner = makeFakeRunner({ drainThrow: new Error("drain boom") });
            const { deps } = makeDeps({ runner });
            const handlers = createDispatcher(deps);
            await handlers.load(loadFrame());
            const reply = JSON.parse(handlers.drain(drainFrame()));
            expect(reply).toEqual({ kind: "fatal", message: "drain boom" });
        });
    });

    describe("dispose", () => {
        it("ack's even when no runner has been loaded", () => {
            const { deps } = makeDeps();
            const handlers = createDispatcher(deps);
            const reply = JSON.parse(handlers.dispose());
            expect(reply).toEqual({ kind: "ack" });
        });

        it("disposes the runner, clears the compiled-default slot, and ack's", async () => {
            const { deps, runner, slot } = makeDeps();
            const handlers = createDispatcher(deps);
            await handlers.load(loadFrame());
            expect(slot.value).toBeDefined();
            const reply = JSON.parse(handlers.dispose());
            expect(reply).toEqual({ kind: "ack" });
            expect(runner.dispose).toHaveBeenCalledOnce();
            expect(slot.value).toBeUndefined();
        });

        it("replies with `fatal` when setCompiledDefault throws", () => {
            const exploding: DispatcherDeps = {
                loadEval: () => undefined,
                runnerFactory: (() =>
                    makeFakeRunner()) as unknown as DispatcherDeps["runnerFactory"],
                getCompiledDefault: () => undefined,
                setCompiledDefault: () => {
                    throw new Error("setter boom");
                },
            };
            const handlers = createDispatcher(exploding);
            const reply = JSON.parse(handlers.dispose());
            expect(reply).toEqual({ kind: "fatal", message: "setter boom" });
        });
    });
});
