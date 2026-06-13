// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import {
    defineIndicator,
    type Bar,
    type CompiledScriptBundle,
    type MutableSlot,
    type StateSnapshot,
    type StateStoreKey,
} from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "../createScriptRunner.js";
import { inMemoryPersistentStateStore } from "../persistentStateStore.js";

type RuntimeStateNamespace = {
    readonly int: (slotId: string, init: number) => MutableSlot<number>;
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
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: {
            lines: 0,
            labels: 0,
            boxes: 0,
            polylines: 0,
            other: 0,
        },
        maxLookback: 50,
        maxTickHz: 10,
    };
}

function key(): StateStoreKey {
    return {
        scriptHash: "script",
        compilerVersion: "0.5.0",
        apiVersion: 1,
        capabilitiesHash: "caps",
        symbol: "AAPL",
        mainInterval: "1m",
        requestedIntervals: [],
    };
}

function makeBar(i: number): Bar {
    const close = 100 + i;
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open: close - 0.5,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1_000 + i,
        symbol: "AAPL",
        interval: "1m",
    };
}

function withLookback<T extends ReturnType<typeof defineIndicator>>(c: T): T {
    return { ...c, manifest: { ...c.manifest, maxLookback: 50 } };
}

function counterIndicator(
    name: string,
    onObserved?: (value: number) => void,
): ReturnType<typeof defineIndicator> {
    return defineIndicator({
        name,
        apiVersion: 1,
        compute: ({ state }) => {
            const runtimeState = state as unknown as RuntimeStateNamespace;
            const counter = runtimeState.int("counter", 0);
            counter.value = counter.value + 1;
            onObserved?.(counter.value);
        },
    });
}

describe("dep persistence — slot-id prefix keys", () => {
    it("writes dep slot keys with dep:<localId>/ prefix to the dep's stateStore", async () => {
        const bundle: CompiledScriptBundle = {
            primary: withLookback(counterIndicator("primary")),
            siblings: [],
            dependencies: [
                {
                    localId: "fast",
                    compiled: withLookback(counterIndicator("fast")),
                },
            ],
        };
        const store = inMemoryPersistentStateStore({ key: key() });
        const seed = createScriptRunner({
            compiled: bundle,
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            now: () => 1,
        });
        await seed.onBarClose(makeBar(0));
        await seed.dispose();

        const snapshot = (await store.load()) as unknown as StateSnapshot;
        expect(Object.keys(snapshot.dependencies?.fast.slots ?? {})).toEqual([
            "dep:fast/counter:state",
        ]);
    });

    it("writes sibling slot keys with export:<exportName>/ prefix", async () => {
        const bundle: CompiledScriptBundle = {
            primary: withLookback(counterIndicator("primary")),
            siblings: [
                {
                    exportName: "slow",
                    compiled: withLookback(counterIndicator("slow")),
                },
            ],
            dependencies: [],
        };
        const store = inMemoryPersistentStateStore({ key: key() });
        const seed = createScriptRunner({
            compiled: bundle,
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            now: () => 1,
        });
        await seed.onBarClose(makeBar(0));
        await seed.dispose();

        const snapshot = (await store.load()) as unknown as StateSnapshot;
        expect(Object.keys(snapshot.siblings?.slow.slots ?? {})).toEqual([
            "export:slow/counter:state",
        ]);
    });
});

describe("dep persistence — warm-restart equivalence", () => {
    it("cold-replay emissions equal warm-restart emissions for a dep bundle", async () => {
        const bundleFactory = (
            observed: number[],
            siblingObserved: number[],
            depObserved: number[],
        ): CompiledScriptBundle => ({
            primary: withLookback(counterIndicator("primary", (v) => observed.push(v))),
            siblings: [
                {
                    exportName: "slow",
                    compiled: withLookback(
                        counterIndicator("slow", (v) => siblingObserved.push(v)),
                    ),
                },
            ],
            dependencies: [
                {
                    localId: "fast",
                    compiled: withLookback(counterIndicator("fast", (v) => depObserved.push(v))),
                },
            ],
        });

        const coldPrimary: number[] = [];
        const coldSibling: number[] = [];
        const coldDep: number[] = [];
        const coldRunner = createScriptRunner({
            compiled: bundleFactory(coldPrimary, coldSibling, coldDep),
            capabilities: makeCapabilities(),
        });
        for (let i = 0; i < 10; i += 1) {
            await coldRunner.onBarClose(makeBar(i));
        }

        const store = inMemoryPersistentStateStore({ key: key() });
        const warmSeedPrimary: number[] = [];
        const warmSeedSibling: number[] = [];
        const warmSeedDep: number[] = [];
        const warmSeed = createScriptRunner({
            compiled: bundleFactory(warmSeedPrimary, warmSeedSibling, warmSeedDep),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            now: () => 1,
        });
        for (let i = 0; i < 5; i += 1) {
            await warmSeed.onBarClose(makeBar(i));
        }
        await warmSeed.dispose();

        const warmPrimary: number[] = [];
        const warmSibling: number[] = [];
        const warmDep: number[] = [];
        const warm = createScriptRunner({
            compiled: bundleFactory(warmPrimary, warmSibling, warmDep),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            now: () => 2,
        });
        await warm.warmStart(makeBar(5).time);
        for (let i = 5; i < 10; i += 1) {
            await warm.onBarClose(makeBar(i));
        }

        // Last 5 observed values from cold should equal warm's 5 values.
        expect(warmPrimary).toEqual(coldPrimary.slice(5));
        expect(warmSibling).toEqual(coldSibling.slice(5));
        expect(warmDep).toEqual(coldDep.slice(5));
    });
});
