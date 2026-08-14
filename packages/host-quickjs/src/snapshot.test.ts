// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type {
    Bar,
    ScriptManifest,
    StateSnapshot,
    StateStoreKey,
} from "@invinite-org/chartlang-core";
import { isSnapshotError } from "@invinite-org/chartlang-core";
import type { HostSnapshot } from "@invinite-org/chartlang-host-worker";
import { describe, expect, it } from "vitest";

import { createQuickJsHost } from "./createQuickJsHost.js";
import type { QuickJsContextLike, QuickJsHandleLike, QuickJsLike, ScriptHost } from "./types.js";

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
 * Plots a value that depends on BOTH a `state.*` slot and a `ta.*`
 * accumulator, so the equivalence check across a snapshot boundary fails
 * unless every state family survives the QuickJS membrane.
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

function compiled(): Parameters<ScriptHost["load"]>[0] {
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

async function plotsOf(host: ScriptHost, bars: ReadonlyArray<Bar>): Promise<number[]> {
    const values: number[] = [];
    for (const b of bars) {
        await host.push({ kind: "close", bar: b });
        const emissions = await host.drain();
        for (const plot of emissions.plots) values.push(plot.value);
    }
    return values;
}

/**
 * A QuickJS stand-in whose snapshot entrypoints return whatever frame the test
 * asks for — the only way to exercise the host's "reply kind I never expect"
 * arms, which the real dispatcher cannot produce.
 */
class StubHandle implements QuickJsHandleLike {
    constructor(readonly value: unknown) {}
    dispose(): void {}
}

class StubContext implements QuickJsContextLike {
    readonly global = new StubHandle(globalThis);
    readonly undefined = new StubHandle(undefined);
    snapshotReply: unknown = { kind: "fatal", message: "boom" };

    evalCode(): unknown {
        return { value: new StubHandle(undefined) };
    }

    getProp(_handle: QuickJsHandleLike, key: string): QuickJsHandleLike {
        if (key === "__chartlang_exportSnapshot" || key === "__chartlang_importSnapshot") {
            return new StubHandle(() => JSON.stringify(this.snapshotReply));
        }
        return new StubHandle(async () => JSON.stringify({ kind: "loaded" }));
    }

    newString(value: string): QuickJsHandleLike {
        return new StubHandle(value);
    }

    callFunction(
        fn: QuickJsHandleLike,
        _thisVal: QuickJsHandleLike,
        ...args: ReadonlyArray<QuickJsHandleLike>
    ): unknown {
        const callable = fn.value;
        if (typeof callable !== "function") throw new Error("not callable");
        return { value: new StubHandle(callable(...args.map((arg) => arg.value))) };
    }

    unwrapResult(result: unknown): QuickJsHandleLike {
        if (result instanceof StubHandle) return result;
        if (result !== null && typeof result === "object" && "value" in result) {
            return (result as { readonly value: QuickJsHandleLike }).value;
        }
        throw new Error("bad stub result");
    }

    getString(handle: QuickJsHandleLike): string {
        return String((handle as StubHandle).value);
    }

    async resolvePromise(handle: QuickJsHandleLike): Promise<unknown> {
        return { value: new StubHandle(await (handle as StubHandle).value) };
    }

    dispose(): void {}
}

function stubQuickJs(context: StubContext): QuickJsLike {
    return () => ({
        newRuntime: () => ({
            setMemoryLimit: () => undefined,
            setInterruptHandler: () => undefined,
            executePendingJobs: () => undefined,
            newContext: () => context,
        }),
    });
}

describe("createQuickJsHost snapshot verbs (real QuickJS)", () => {
    it("round-trips a resumed host against an uninterrupted one", async () => {
        const control = createQuickJsHost({
            capabilities: makeCapabilities(),
            stateStoreKey: key(),
        });
        await control.load(compiled());
        const straight = await plotsOf(
            control,
            Array.from({ length: 10 }, (_unused, i) => bar(i)),
        );
        control.dispose();

        const cold = createQuickJsHost({
            capabilities: makeCapabilities(),
            stateStoreKey: key(),
        });
        await cold.load(compiled());
        const firstLeg = await plotsOf(
            cold,
            Array.from({ length: 6 }, (_unused, i) => bar(i)),
        );
        const exported = await cold.exportSnapshot();
        expect(exported).not.toBeNull();
        expect(exported?.key).toEqual(key());
        cold.dispose();

        const warm = createQuickJsHost({
            capabilities: makeCapabilities(),
            stateStoreKey: key(),
        });
        await warm.load(compiled());
        const ack = await warm.importSnapshot(exported as HostSnapshot);
        expect(ack).toEqual({ barIndex: 5 });
        const secondLeg = await plotsOf(
            warm,
            Array.from({ length: 4 }, (_unused, i) => bar(ack.barIndex + 1 + i)),
        );
        warm.dispose();

        expect([...firstLeg, ...secondLeg]).toEqual(straight);
    });

    it("survives a JSON round trip of the exported envelope", async () => {
        const source = createQuickJsHost({
            capabilities: makeCapabilities(),
            stateStoreKey: key(),
        });
        await source.load(compiled());
        await source.push({ kind: "close", bar: bar(0) });
        const exported = await source.exportSnapshot();
        source.dispose();

        const persisted = JSON.parse(JSON.stringify(exported)) as HostSnapshot;
        const target = createQuickJsHost({
            capabilities: makeCapabilities(),
            stateStoreKey: key(),
        });
        await target.load(compiled());
        expect(await target.importSnapshot(persisted)).toEqual({ barIndex: 0 });
        target.dispose();
    });

    it("rejects exportSnapshot before load with a typed error", async () => {
        const host = createQuickJsHost({ capabilities: makeCapabilities() });
        const err = await host.exportSnapshot().catch((e: unknown) => e);
        expect(isSnapshotError(err)).toBe(true);
        expect((err as Error).message).toBe("exportSnapshot before load");
        host.dispose();
    });

    it("rejects an import after the first push", async () => {
        const host = createQuickJsHost({ capabilities: makeCapabilities() });
        await host.load(compiled());
        await host.push({ kind: "close", bar: bar(0) });
        const exported = { key: null, snapshot: {} as StateSnapshot };
        await expect(host.importSnapshot(exported)).rejects.toThrow(
            "importSnapshot after the first push",
        );
        host.dispose();
    });

    it("rejects a snapshot captured under a different key", async () => {
        const source = createQuickJsHost({
            capabilities: makeCapabilities(),
            stateStoreKey: key(),
        });
        await source.load(compiled());
        await source.push({ kind: "close", bar: bar(0) });
        const exported = await source.exportSnapshot();
        source.dispose();

        const target = createQuickJsHost({
            capabilities: makeCapabilities(),
            stateStoreKey: key({ compilerVersion: "9.9.9" }),
        });
        await target.load(compiled());
        await expect(target.importSnapshot(exported as HostSnapshot)).rejects.toThrow(
            "importSnapshot state store key mismatch",
        );
        target.dispose();
    });

    it("rejects a malformed payload", async () => {
        const host = createQuickJsHost({ capabilities: makeCapabilities() });
        await host.load(compiled());
        await expect(
            host.importSnapshot({
                key: null,
                snapshot: { nope: true } as unknown as StateSnapshot,
            }),
        ).rejects.toThrow(/failed validation/);
        host.dispose();
    });
});

describe("createQuickJsHost snapshot verbs (unexpected guest replies)", () => {
    it("wraps a non-snapshot export reply in a SnapshotError", async () => {
        const context = new StubContext();
        const host = createQuickJsHost({
            capabilities: makeCapabilities(),
            quickJsLike: stubQuickJs(context),
        });
        const err = await host.exportSnapshot().catch((e: unknown) => e);
        expect(isSnapshotError(err)).toBe(true);
        expect((err as Error).message).toBe("exportSnapshot failed");
    });

    it("resolves null when the guest captured nothing", async () => {
        const context = new StubContext();
        context.snapshotReply = { kind: "snapshot", nonce: 0, snapshot: null, key: null };
        const host = createQuickJsHost({
            capabilities: makeCapabilities(),
            quickJsLike: stubQuickJs(context),
        });
        await expect(host.exportSnapshot()).resolves.toBeNull();
    });

    it("wraps a non-snapshotImported import reply in a SnapshotError", async () => {
        const context = new StubContext();
        const host = createQuickJsHost({
            capabilities: makeCapabilities(),
            quickJsLike: stubQuickJs(context),
        });
        const err = await host
            .importSnapshot({ key: null, snapshot: {} as StateSnapshot })
            .catch((e: unknown) => e);
        expect(isSnapshotError(err)).toBe(true);
        expect((err as Error).message).toBe("importSnapshot failed");
    });
});
