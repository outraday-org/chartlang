// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities as capsHelpers } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities, RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";
import type {
    CompiledScriptBundle,
    CompiledScriptObject,
    ScriptManifest,
} from "@invinite-org/chartlang-core";
import { describe, expect, it, vi } from "vitest";

import { type DispatcherDeps, createDispatcher } from "./dispatcherCore.js";
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
        multiSymbol: false,
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
    setPlotOverrides: ReturnType<typeof vi.fn>;
    setExternalSeries: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    onHistory: ReturnType<typeof vi.fn>;
    onBarClose: ReturnType<typeof vi.fn>;
    onBarTick: ReturnType<typeof vi.fn>;
    warmStart: ReturnType<typeof vi.fn>;
};

function makeFakeRunner(opts?: {
    pushThrow?: Error;
    drainThrow?: Error;
    setPlotOverridesThrow?: Error;
    setExternalSeriesThrow?: Error;
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
        setPlotOverrides: vi.fn(() => {
            if (opts?.setPlotOverridesThrow !== undefined) throw opts.setPlotOverridesThrow;
        }),
        setExternalSeries: vi.fn(() => {
            if (opts?.setExternalSeriesThrow !== undefined) throw opts.setExternalSeriesThrow;
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
type NamedSlot = { value: Readonly<Record<string, CompiledScriptObject>> | undefined };
type DepsSlot = {
    value:
        | ReadonlyArray<{ readonly localId: string; readonly compiled: CompiledScriptObject }>
        | undefined;
};
type ManifestSlot = {
    value: ScriptManifest | ReadonlyArray<ScriptManifest> | undefined;
};

function makeDeps(opts?: {
    slot?: Slot;
    runner?: FakeRunner;
    loadEvalThrow?: Error;
    skipSetDefault?: boolean;
    bundleSeed?: (
        defaultSlot: Slot,
        named: NamedSlot,
        deps: DepsSlot,
        manifest: ManifestSlot,
    ) => void;
}): {
    deps: DispatcherDeps;
    runner: FakeRunner;
    slot: Slot;
    named: NamedSlot;
    depsSlot: DepsSlot;
    manifestSlot: ManifestSlot;
    loadEval: ReturnType<typeof vi.fn>;
    runnerFactory: ReturnType<typeof vi.fn>;
} {
    const slot: Slot = opts?.slot ?? { value: undefined };
    const named: NamedSlot = { value: undefined };
    const depsSlot: DepsSlot = { value: undefined };
    const manifestSlot: ManifestSlot = { value: undefined };
    const runner = opts?.runner ?? makeFakeRunner();
    const compiledStub: CompiledScriptObject = {
        manifest: makeManifest(),
        compute: () => {},
    };
    const loadEval = vi.fn((_source: string) => {
        if (opts?.loadEvalThrow !== undefined) throw opts.loadEvalThrow;
        if (opts?.bundleSeed !== undefined) {
            opts.bundleSeed(slot, named, depsSlot, manifestSlot);
            return undefined;
        }
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
        getCompiledNamed: () => named.value,
        setCompiledNamed: (v) => {
            named.value = v;
        },
        getCompiledDependencies: () => depsSlot.value,
        setCompiledDependencies: (v) => {
            depsSlot.value = v;
        },
        getCompiledManifest: () => manifestSlot.value,
        setCompiledManifest: (v) => {
            manifestSlot.value = v;
        },
    };
    return { deps, runner, slot, named, depsSlot, manifestSlot, loadEval, runnerFactory };
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

function setPlotOverridesFrame(
    overrides: Record<string, { visible?: boolean; color?: string }> = {
        "p:1:1#0": { visible: false },
    },
): string {
    return JSON.stringify({ kind: "setPlotOverrides", overrides } as HostToQuickJs);
}

function setExternalSeriesFrame(
    feeds: Record<string, { readonly values: ReadonlyArray<number> }> = {
        feed: { values: [1, 2] },
    },
): string {
    return JSON.stringify({ kind: "setExternalSeries", feeds } as HostToQuickJs);
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
        expect(typeof handlers.setPlotOverrides).toBe("function");
        expect(typeof handlers.setExternalSeries).toBe("function");
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

        it("forwards optional plotOverrides into the runner factory", async () => {
            const { deps, runnerFactory } = makeDeps();
            const handlers = createDispatcher(deps);
            const reply = await handlers.load(
                loadFrame({ plotOverrides: { "p:1:1#0": { color: "#f00" } } }),
            );
            expect(JSON.parse(reply).kind).toBe("loaded");
            const args = runnerFactory.mock.calls[0][0] as Parameters<
                DispatcherDeps["runnerFactory"]
            >[0];
            expect(args.plotOverrides).toEqual({ "p:1:1#0": { color: "#f00" } });
        });

        it("forwards optional externalSeriesFeeds into the runner factory", async () => {
            const { deps, runnerFactory } = makeDeps();
            const handlers = createDispatcher(deps);
            const reply = await handlers.load(
                loadFrame({ externalSeriesFeeds: { feed: { values: [1, 2] } } }),
            );
            expect(JSON.parse(reply).kind).toBe("loaded");
            const args = runnerFactory.mock.calls[0][0] as Parameters<
                DispatcherDeps["runnerFactory"]
            >[0];
            expect(args.externalSeriesFeeds).toEqual({ feed: { values: [1, 2] } });
        });

        it("omits plotOverrides from the runner factory args when absent on the frame", async () => {
            const { deps, runnerFactory } = makeDeps();
            const handlers = createDispatcher(deps);
            await handlers.load(loadFrame());
            const args = runnerFactory.mock.calls[0][0] as Parameters<
                DispatcherDeps["runnerFactory"]
            >[0];
            expect("plotOverrides" in args).toBe(false);
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

        it("mounts a multi-export bundle when the manifest sidecar is an array", async () => {
            // §22.10 indicator-composition: the guest's rewritten module
            // assigns both `default` and one or more named exports into
            // host-realm-visible globals; the dispatcher reads them back
            // and packages a `CompiledScriptBundle` for the runtime.
            const primary: CompiledScriptObject = {
                manifest: makeManifest(),
                compute: () => {},
            };
            const sibling: CompiledScriptObject = {
                manifest: { ...makeManifest(), name: "sibling" },
                compute: () => {},
            };
            const manifest: ReadonlyArray<ScriptManifest> = [
                { ...makeManifest(), exportName: "default", isDrawn: true },
                { ...makeManifest(), name: "sibling", exportName: "sibling", isDrawn: true },
            ];
            const { deps, runnerFactory } = makeDeps({
                bundleSeed: (defaultSlot, named, _depsSlot, manifestSlot) => {
                    defaultSlot.value = primary;
                    named.value = { sibling };
                    manifestSlot.value = manifest;
                },
            });
            const handlers = createDispatcher(deps);
            const reply = JSON.parse(await handlers.load(loadFrame()));
            expect(reply).toEqual({ kind: "loaded" });
            const args = runnerFactory.mock.calls[0][0] as Parameters<
                DispatcherDeps["runnerFactory"]
            >[0];
            const bundle = args.compiled as CompiledScriptBundle;
            expect(bundle.primary).toBe(primary);
            expect(bundle.siblings).toHaveLength(1);
            expect(bundle.siblings[0]).toEqual({ exportName: "sibling", compiled: sibling });
            expect(bundle.dependencies).toEqual([]);
        });

        it("adopts the single-object __manifest sidecar for a single script", async () => {
            // The runtime `defineIndicator` stub zeroes `requestedIntervals`,
            // so the dispatcher must mount the compiler's `__manifest` sidecar
            // for a single-script module — otherwise an MTF script's secondary
            // streams never register. Mirrors host-worker's
            // `buildBundleFromModule`.
            const primary: CompiledScriptObject = {
                manifest: makeManifest(),
                compute: () => {},
            };
            const sidecar: ScriptManifest = {
                ...makeManifest(),
                requestedIntervals: ["1W"],
            };
            const { deps, runnerFactory } = makeDeps({
                bundleSeed: (defaultSlot, _named, _depsSlot, manifestSlot) => {
                    defaultSlot.value = primary;
                    manifestSlot.value = sidecar;
                },
            });
            const handlers = createDispatcher(deps);
            const reply = JSON.parse(await handlers.load(loadFrame()));
            expect(reply).toEqual({ kind: "loaded" });
            const args = runnerFactory.mock.calls[0][0] as Parameters<
                DispatcherDeps["runnerFactory"]
            >[0];
            const compiled = args.compiled as CompiledScriptObject;
            expect(compiled.manifest.requestedIntervals).toEqual(["1W"]);
            expect(compiled.compute).toBe(primary.compute);
        });

        it("mounts a bundle when the guest emits __dependencies even without an array manifest", async () => {
            const primary: CompiledScriptObject = {
                manifest: makeManifest(),
                compute: () => {},
            };
            const dep: CompiledScriptObject = {
                manifest: { ...makeManifest(), name: "base" },
                compute: () => {},
            };
            const { deps, runnerFactory } = makeDeps({
                bundleSeed: (defaultSlot, _named, depsSlot, _manifestSlot) => {
                    defaultSlot.value = primary;
                    depsSlot.value = [{ localId: "base", compiled: dep }];
                },
            });
            const handlers = createDispatcher(deps);
            const reply = JSON.parse(await handlers.load(loadFrame()));
            expect(reply).toEqual({ kind: "loaded" });
            const args = runnerFactory.mock.calls[0][0] as Parameters<
                DispatcherDeps["runnerFactory"]
            >[0];
            const bundle = args.compiled as CompiledScriptBundle;
            expect(bundle.primary).toBe(primary);
            expect(bundle.siblings).toEqual([]);
            expect(bundle.dependencies).toEqual([{ localId: "base", compiled: dep }]);
        });

        it("forwards __dependencies inputOverrides through to the bundle", async () => {
            // §22.10 indicator-composition: a cross-file consumer's
            // merged `.withInputs({...})` overrides are baked into the
            // compiled `__dependencies[i].inputOverrides` slot. The
            // dispatcher must preserve them on the bundle so the
            // runtime mounts the dep with the consumer-supplied values.
            const primary: CompiledScriptObject = {
                manifest: makeManifest(),
                compute: () => {},
            };
            const dep: CompiledScriptObject = {
                manifest: { ...makeManifest(), name: "base" },
                compute: () => {},
            };
            const { deps, runnerFactory } = makeDeps({
                bundleSeed: (defaultSlot, _named, depsSlot, _manifestSlot) => {
                    defaultSlot.value = primary;
                    depsSlot.value = [
                        { localId: "base", compiled: dep, inputOverrides: { length: 30 } },
                    ];
                },
            });
            const handlers = createDispatcher(deps);
            const reply = JSON.parse(await handlers.load(loadFrame()));
            expect(reply).toEqual({ kind: "loaded" });
            const args = runnerFactory.mock.calls[0][0] as Parameters<
                DispatcherDeps["runnerFactory"]
            >[0];
            const bundle = args.compiled as CompiledScriptBundle;
            expect(bundle.dependencies).toEqual([
                { localId: "base", compiled: dep, inputOverrides: { length: 30 } },
            ]);
        });

        it("skips a sibling entry when its named export is missing from the global map", async () => {
            // The dispatcher tolerates a malformed bundle (manifest
            // promises a sibling but the guest never seeded the named
            // export). The primary still loads; the sibling is dropped.
            const primary: CompiledScriptObject = {
                manifest: makeManifest(),
                compute: () => {},
            };
            const manifest: ReadonlyArray<ScriptManifest> = [
                { ...makeManifest(), exportName: "default", isDrawn: true },
                { ...makeManifest(), name: "missing", exportName: "missing", isDrawn: true },
            ];
            const { deps, runnerFactory } = makeDeps({
                bundleSeed: (defaultSlot, named, _depsSlot, manifestSlot) => {
                    defaultSlot.value = primary;
                    // Crucially: `missing` is NOT in the named map.
                    named.value = {};
                    manifestSlot.value = manifest;
                },
            });
            const handlers = createDispatcher(deps);
            const reply = JSON.parse(await handlers.load(loadFrame()));
            expect(reply).toEqual({ kind: "loaded" });
            const args = runnerFactory.mock.calls[0][0] as Parameters<
                DispatcherDeps["runnerFactory"]
            >[0];
            const bundle = args.compiled as CompiledScriptBundle;
            expect(bundle.siblings).toEqual([]);
        });

        it("skips entries that omit exportName or name the default export", async () => {
            const primary: CompiledScriptObject = {
                manifest: makeManifest(),
                compute: () => {},
            };
            const manifest: ReadonlyArray<ScriptManifest> = [
                { ...makeManifest(), exportName: "default", isDrawn: true },
                { ...makeManifest(), name: "no-export-name" },
                { ...makeManifest(), name: "default-dup", exportName: "default" },
            ];
            const { deps, runnerFactory } = makeDeps({
                bundleSeed: (defaultSlot, named, _depsSlot, manifestSlot) => {
                    defaultSlot.value = primary;
                    named.value = {};
                    manifestSlot.value = manifest;
                },
            });
            const handlers = createDispatcher(deps);
            const reply = JSON.parse(await handlers.load(loadFrame()));
            expect(reply).toEqual({ kind: "loaded" });
            const args = runnerFactory.mock.calls[0][0] as Parameters<
                DispatcherDeps["runnerFactory"]
            >[0];
            const bundle = args.compiled as CompiledScriptBundle;
            expect(bundle.siblings).toEqual([]);
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

    describe("setPlotOverrides", () => {
        it("replies with `fatal` before load", () => {
            const { deps } = makeDeps();
            const handlers = createDispatcher(deps);
            const reply = JSON.parse(handlers.setPlotOverrides(setPlotOverridesFrame()));
            expect(reply).toEqual({ kind: "fatal", message: "setPlotOverrides before load" });
        });

        it("forwards the parsed overrides to runner.setPlotOverrides and replies with `ack`", async () => {
            const { deps, runner } = makeDeps();
            const handlers = createDispatcher(deps);
            await handlers.load(loadFrame());
            const reply = JSON.parse(
                handlers.setPlotOverrides(setPlotOverridesFrame({ "p:1:1#0": { color: "#0f0" } })),
            );
            expect(reply).toEqual({ kind: "ack" });
            expect(runner.setPlotOverrides).toHaveBeenCalledWith({ "p:1:1#0": { color: "#0f0" } });
        });

        it("replies with `fatal` when runner.setPlotOverrides throws", async () => {
            const runner = makeFakeRunner({
                setPlotOverridesThrow: new Error("override boom"),
            });
            const { deps } = makeDeps({ runner });
            const handlers = createDispatcher(deps);
            await handlers.load(loadFrame());
            const reply = JSON.parse(handlers.setPlotOverrides(setPlotOverridesFrame()));
            expect(reply).toEqual({ kind: "fatal", message: "override boom" });
        });
    });

    describe("setExternalSeries", () => {
        it("replies with `fatal` before load", () => {
            const { deps } = makeDeps();
            const handlers = createDispatcher(deps);
            const reply = JSON.parse(handlers.setExternalSeries(setExternalSeriesFrame()));
            expect(reply).toEqual({ kind: "fatal", message: "setExternalSeries before load" });
        });

        it("forwards the parsed feeds to runner.setExternalSeries and replies with `ack`", async () => {
            const { deps, runner } = makeDeps();
            const handlers = createDispatcher(deps);
            await handlers.load(loadFrame());
            const reply = JSON.parse(
                handlers.setExternalSeries(setExternalSeriesFrame({ feed: { values: [10] } })),
            );
            expect(reply).toEqual({ kind: "ack" });
            expect(runner.setExternalSeries).toHaveBeenCalledWith({ feed: { values: [10] } });
        });

        it("replies with `fatal` when runner.setExternalSeries throws", async () => {
            const runner = makeFakeRunner({
                setExternalSeriesThrow: new Error("external boom"),
            });
            const { deps } = makeDeps({ runner });
            const handlers = createDispatcher(deps);
            await handlers.load(loadFrame());
            const reply = JSON.parse(handlers.setExternalSeries(setExternalSeriesFrame()));
            expect(reply).toEqual({ kind: "fatal", message: "external boom" });
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
