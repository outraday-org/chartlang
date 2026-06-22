// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { CandleEvent, Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type WorkerBootScope, createWorkerBoot } from "./createWorkerBoot.js";
import type { HostToWorker, WorkerToHost } from "./protocol.js";
import type { HostLimits } from "./types.js";

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

    it("registers secondary streams from a single-object __manifest sidecar", async () => {
        // The runtime `defineIndicator` stub zeroes `requestedIntervals`,
        // so the boot must adopt the compiler's `__manifest` sidecar for a
        // single-script module — otherwise an MTF script's secondary stream
        // is never registered and every secondary candle is dropped with an
        // `unknown-secondary-stream` warning.
        const mtfManifest: ScriptManifest = {
            ...manifest(),
            name: "mtf",
            requestedIntervals: ["1W"],
        };
        const moduleSource = `
            const d = {
                manifest: ${JSON.stringify(manifest())},
                compute: () => {},
            };
            export default d;
            export const __manifest = ${JSON.stringify(mtfManifest)};
        `;
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        await deliver({
            kind: "load",
            compiled: { moduleSource, manifest: mtfManifest },
            capabilities: makeCapabilities(),
            limits: LIMITS,
        });
        await waitFor("loaded");
        // A secondary "1W" candle is accepted only if the stream was
        // registered from the `__manifest` sidecar.
        await deliver({
            kind: "candleEvent",
            event: { kind: "close", bar: bar(1, 1), streamKey: "1W" },
        });
        await deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(2, 2) } });
        await deliver({ kind: "drain", nonce: 7 });
        const reply = await waitFor("emissions");
        if (reply.kind !== "emissions") throw new Error("expected emissions");
        expect(reply.emissions.diagnostics.some((d) => d.code === "unknown-secondary-stream")).toBe(
            false,
        );
    });

    it("passes structured input overrides into the runner at load", async () => {
        const { scope, deliver, captured, waitFor } = makeScope();
        createWorkerBoot(scope);
        const m: ScriptManifest = {
            ...manifest(),
            inputs: {
                length: { kind: "int", defaultValue: 14 },
            },
        };
        const moduleSource = `
            export default {
                manifest: ${JSON.stringify(m)},
                compute: ({ inputs }) => {
                    if (inputs.length !== 20) throw new Error("bad input " + inputs.length);
                },
            };
        `;
        await deliver({
            kind: "load",
            compiled: { moduleSource, manifest: m },
            capabilities: makeCapabilities(),
            inputOverrides: { length: 20 },
            limits: LIMITS,
        });
        await waitFor("loaded");
        await deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(1, 1) } });
        expect(captured.some((msg) => msg.kind === "fatal")).toBe(false);
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

    it("accepts optional load sym-info metadata", async () => {
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        await deliver({
            kind: "load",
            compiled: { moduleSource: NOOP_MODULE_SOURCE, manifest: manifest() },
            capabilities: { ...makeCapabilities(), symInfoFields: new Set(["ticker"]) },
            symInfo: { ticker: "DEMO" },
            limits: LIMITS,
        });
        const reply = await waitFor("loaded");
        expect(reply.kind).toBe("loaded");
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

    it("threads load-frame plotOverrides into the runner and applies them on emit", async () => {
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        const m: ScriptManifest = { ...manifest() };
        const moduleSource = `
            export default {
                manifest: ${JSON.stringify(m)},
                compute: ({ bar, plot }) => {
                    plot("p:1:1#0", bar.close, { color: "#000" });
                },
            };
        `;
        await deliver({
            kind: "load",
            compiled: { moduleSource, manifest: m },
            capabilities: makeCapabilities(),
            plotOverrides: { "p:1:1#0": { visible: false, color: "#f00" } },
            limits: LIMITS,
        });
        await waitFor("loaded");
        await deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(1, 5) } });
        await deliver({ kind: "drain", nonce: 1 });
        const reply = await waitFor("emissions");
        if (reply.kind !== "emissions") throw new Error("expected emissions");
        expect(reply.emissions.plots[0]).toMatchObject({ visible: false, color: "#f00" });
    });

    it("swaps overrides live via setPlotOverrides without a recompute", async () => {
        const { scope, deliver, captured } = makeScope();
        createWorkerBoot(scope);
        const m: ScriptManifest = { ...manifest() };
        const moduleSource = `
            export default {
                manifest: ${JSON.stringify(m)},
                compute: ({ bar, plot }) => {
                    plot("p:1:1#0", bar.close, { color: "#000" });
                },
            };
        `;
        await deliver({
            kind: "load",
            compiled: { moduleSource, manifest: m },
            capabilities: makeCapabilities(),
            limits: LIMITS,
        });
        await deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(1, 5) } });
        await deliver({ kind: "drain", nonce: 1 });
        await deliver({ kind: "setPlotOverrides", overrides: { "p:1:1#0": { color: "#0f0" } } });
        await deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(2, 6) } });
        await deliver({ kind: "drain", nonce: 2 });

        const byNonce = (nonce: number) =>
            captured.find((c) => c.kind === "emissions" && c.nonce === nonce);
        const first = byNonce(1);
        const second = byNonce(2);
        if (first?.kind !== "emissions" || second?.kind !== "emissions") {
            throw new Error("expected two emissions replies");
        }
        expect(first.emissions.plots[0].color).toBe("#000");
        expect(second.emissions.plots[0].color).toBe("#0f0");
    });

    it("posts 'fatal' for a setPlotOverrides before load", async () => {
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        await deliver({ kind: "setPlotOverrides", overrides: {} });
        const reply = await waitFor("fatal");
        if (reply.kind !== "fatal") throw new Error("expected fatal");
        expect(reply.message).toContain("setPlotOverrides before load");
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

    it("mounts a multi-export bundle when the module sidecar is an array", async () => {
        // §22.10 indicator-composition: a multi-export `.chart.ts` file
        // emits an array `__manifest` sidecar + one named export per
        // drawn sibling. The boot detects the array shape and builds a
        // `CompiledScriptBundle` so the runtime mounts both the primary
        // and the sibling. The sibling's plot reaches `drain()` with an
        // `export:<name>/` slot-id prefix.
        const primaryManifest: ScriptManifest = {
            ...manifest(),
            name: "primary",
            exportName: "default",
            isDrawn: true,
        };
        const siblingManifest: ScriptManifest = {
            ...manifest(),
            name: "sibling",
            exportName: "sibling",
            isDrawn: true,
        };
        const moduleSource = `
            const sibling = {
                manifest: ${JSON.stringify(siblingManifest)},
                compute: (ctx) => {
                    ctx.plot("sibling.chart.ts:1:1#0", 99, { title: "echo" });
                },
            };
            const d = {
                manifest: ${JSON.stringify(primaryManifest)},
                compute: () => {},
            };
            export { sibling };
            export default d;
            export const __manifest = ${JSON.stringify([primaryManifest, siblingManifest])};
        `;
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        await deliver({
            kind: "load",
            compiled: { moduleSource, manifest: primaryManifest },
            capabilities: makeCapabilities(),
            limits: LIMITS,
        });
        await waitFor("loaded");
        await deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(1, 1) } });
        await deliver({ kind: "drain", nonce: 11 });
        const reply = await waitFor("emissions");
        if (reply.kind !== "emissions") throw new Error("expected emissions");
        const slotIds = reply.emissions.plots.map((p) => p.slotId);
        // The sibling's plot reaches drain with the export-name prefix.
        expect(slotIds.some((id) => id.startsWith("export:sibling/"))).toBe(true);
    });

    it("mounts a bundle when the module exports __dependencies even without an array sidecar", async () => {
        // The bundle detection branches on EITHER array `__manifest` OR a
        // non-empty `__dependencies` export. This case carries a private
        // dep but only a single drawn primary (so `__manifest` stays a
        // single object).
        const primaryManifest: ScriptManifest = {
            ...manifest(),
            name: "primary",
            dependencies: [
                Object.freeze({
                    localId: "base",
                    sourcePath: "demo.chart.ts",
                    exportName: "default",
                    inputOverrides: Object.freeze({}),
                }),
            ],
        };
        const depManifest: ScriptManifest = {
            ...manifest(),
            name: "base",
            outputs: Object.freeze([Object.freeze({ title: "line", kind: "line" as const })]),
        };
        const moduleSource = `
            const base = {
                manifest: ${JSON.stringify(depManifest)},
                compute: (ctx) => {
                    ctx.plot("base.chart.ts:1:1#0", 7, { title: "line" });
                },
            };
            const d = {
                manifest: ${JSON.stringify(primaryManifest)},
                compute: () => {},
            };
            export default d;
            export const __manifest = ${JSON.stringify(primaryManifest)};
            export const __dependencies = [{ localId: "base", compiled: base }];
        `;
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        await deliver({
            kind: "load",
            compiled: { moduleSource, manifest: primaryManifest },
            capabilities: makeCapabilities(),
            limits: LIMITS,
        });
        await waitFor("loaded");
        await deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(1, 1) } });
        await deliver({ kind: "drain", nonce: 12 });
        const reply = await waitFor("emissions");
        if (reply.kind !== "emissions") throw new Error("expected emissions");
        // The dep's plot is DROPPED from the parent (private-dep
        // emission policy). No plot reaches drain with a `dep:` slot-id.
        expect(reply.emissions.plots.some((p) => p.slotId.startsWith("dep:"))).toBe(false);
    });

    it("forwards `inputOverrides` from __dependencies entries into the runtime bundle", async () => {
        // §22.10 indicator-composition: a cross-file consumer's
        // `baseTrend.withInputs({...})` alias bakes the merged input
        // overrides into the `__dependencies[i].inputOverrides` slot
        // so the runtime mounts the dep with the consumer-supplied
        // values instead of the producer's defaults.
        const primaryManifest: ScriptManifest = {
            ...manifest(),
            name: "primary",
            dependencies: [
                Object.freeze({
                    localId: "base",
                    sourcePath: "demo.chart.ts",
                    exportName: "default",
                    inputOverrides: Object.freeze({ length: 20 }),
                }),
            ],
        };
        const depManifest: ScriptManifest = {
            ...manifest(),
            name: "base",
            outputs: Object.freeze([Object.freeze({ title: "line", kind: "line" as const })]),
        };
        const moduleSource = `
            const base = {
                manifest: ${JSON.stringify(depManifest)},
                compute: (ctx) => {
                    ctx.plot("base.chart.ts:1:1#0", 7, { title: "line" });
                },
            };
            const d = {
                manifest: ${JSON.stringify(primaryManifest)},
                compute: () => {},
            };
            export default d;
            export const __manifest = ${JSON.stringify(primaryManifest)};
            export const __dependencies = [{ localId: "base", compiled: base, inputOverrides: { length: 20 } }];
        `;
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        await deliver({
            kind: "load",
            compiled: { moduleSource, manifest: primaryManifest },
            capabilities: makeCapabilities(),
            limits: LIMITS,
        });
        const loaded = await waitFor("loaded");
        // The mount succeeded without throwing — the worker accepted
        // the `__dependencies[i].inputOverrides` field and forwarded
        // it through to the runtime's `createScriptRunner`.
        expect(loaded.kind).toBe("loaded");
    });

    it("skips a sibling entry when the named export is missing or malformed", async () => {
        // Defence-in-depth: a malformed bundle that declares a sibling
        // in `__manifest` but never exports the matching binding still
        // loads — the boot drops the bad entry and mounts the primary.
        const primaryManifest: ScriptManifest = {
            ...manifest(),
            name: "primary",
            exportName: "default",
            isDrawn: true,
        };
        const siblingManifest: ScriptManifest = {
            ...manifest(),
            name: "sibling",
            exportName: "sibling",
            isDrawn: true,
        };
        const moduleSource = `
            const d = {
                manifest: ${JSON.stringify(primaryManifest)},
                compute: () => {},
            };
            // Note: no \`sibling\` export, but the sidecar still lists it.
            export default d;
            export const __manifest = ${JSON.stringify([primaryManifest, siblingManifest])};
        `;
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        await deliver({
            kind: "load",
            compiled: { moduleSource, manifest: primaryManifest },
            capabilities: makeCapabilities(),
            limits: LIMITS,
        });
        await waitFor("loaded");
        await deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(1, 1) } });
        await deliver({ kind: "drain", nonce: 13 });
        const reply = await waitFor("emissions");
        if (reply.kind !== "emissions") throw new Error("expected emissions");
        expect(reply.emissions.plots).toEqual([]);
    });

    it("skips a sibling entry when the manifest array entry omits exportName or names default", async () => {
        // §22.10 contract: only non-default entries with an `exportName`
        // become siblings. Both `undefined` exportName and `"default"`
        // are filtered out — the first manifest in the array is the
        // primary, never a sibling.
        const primaryManifest: ScriptManifest = {
            ...manifest(),
            name: "primary",
            exportName: "default",
            isDrawn: true,
        };
        const malformedNoName: ScriptManifest = {
            ...manifest(),
            name: "malformed-no-name",
            isDrawn: true,
        };
        const malformedDefault: ScriptManifest = {
            ...manifest(),
            name: "malformed-default-dup",
            exportName: "default",
            isDrawn: true,
        };
        const moduleSource = `
            const d = {
                manifest: ${JSON.stringify(primaryManifest)},
                compute: () => {},
            };
            export default d;
            export const __manifest = ${JSON.stringify([primaryManifest, malformedNoName, malformedDefault])};
        `;
        const { scope, deliver, waitFor } = makeScope();
        createWorkerBoot(scope);
        await deliver({
            kind: "load",
            compiled: { moduleSource, manifest: primaryManifest },
            capabilities: makeCapabilities(),
            limits: LIMITS,
        });
        await waitFor("loaded");
        await deliver({ kind: "candleEvent", event: { kind: "close", bar: bar(1, 1) } });
        await deliver({ kind: "drain", nonce: 14 });
        const reply = await waitFor("emissions");
        if (reply.kind !== "emissions") throw new Error("expected emissions");
        expect(reply.emissions.plots).toEqual([]);
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
