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

import { createScriptRunner } from "./createScriptRunner.js";
import { inMemoryPersistentStateStore } from "./persistentStateStore.js";
import type { PersistentStateStore } from "./persistentStateStore.js";

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

function counterIndicator(name: string): ReturnType<typeof defineIndicator> {
    return defineIndicator({
        name,
        apiVersion: 1,
        compute: ({ state }) => {
            const runtimeState = state as unknown as RuntimeStateNamespace;
            const counter = runtimeState.int("counter", 0);
            counter.value = counter.value + 1;
        },
    });
}

function bundleOf(opts: {
    readonly primary?: ReturnType<typeof defineIndicator>;
    readonly siblings?: ReadonlyArray<{
        readonly exportName: string;
        readonly compiled: ReturnType<typeof defineIndicator>;
    }>;
    readonly dependencies?: ReadonlyArray<{
        readonly localId: string;
        readonly compiled: ReturnType<typeof defineIndicator>;
    }>;
}): CompiledScriptBundle {
    return {
        primary: withLookback(opts.primary ?? counterIndicator("primary")),
        siblings: (opts.siblings ?? []).map((s) => ({
            exportName: s.exportName,
            compiled: withLookback(s.compiled),
        })),
        dependencies: (opts.dependencies ?? []).map((d) => ({
            localId: d.localId,
            compiled: withLookback(d.compiled),
        })),
    };
}

describe("persistent state snapshot capture", () => {
    it("emits primary-only sections for a single-script runner", async () => {
        let saved: StateSnapshot | null = null;
        const store: PersistentStateStore = {
            key: key(),
            async load() {
                return null;
            },
            async save(snap) {
                saved = snap;
            },
            async clear() {},
        };
        const runner = createScriptRunner({
            compiled: withLookback(counterIndicator("solo")),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            now: () => 1,
        });
        await runner.onBarClose(makeBar(0));
        await runner.dispose();

        expect(saved).not.toBeNull();
        const snapshot = saved as unknown as StateSnapshot;
        expect(snapshot.primary.slots).toEqual({
            "counter:state": { committed: 1, tentative: 1 },
        });
        expect(snapshot.siblings).toBeUndefined();
        expect(snapshot.dependencies).toBeUndefined();
    });

    it("emits structured sections for a bundle runner", async () => {
        let saved: StateSnapshot | null = null;
        const store: PersistentStateStore = {
            key: key(),
            async load() {
                return null;
            },
            async save(snap) {
                saved = snap;
            },
            async clear() {},
        };
        const bundle = bundleOf({
            primary: counterIndicator("primary"),
            siblings: [{ exportName: "slow", compiled: counterIndicator("slow") }],
            dependencies: [{ localId: "fast", compiled: counterIndicator("fast") }],
        });
        const runner = createScriptRunner({
            compiled: bundle,
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            now: () => 1,
        });
        await runner.onBarClose(makeBar(0));
        await runner.dispose();

        expect(saved).not.toBeNull();
        const snapshot = saved as unknown as StateSnapshot;
        expect(snapshot.primary.slots).toEqual({
            "counter:state": { committed: 1, tentative: 1 },
        });
        expect(snapshot.siblings?.slow.slots).toEqual({
            "export:slow/counter:state": { committed: 1, tentative: 1 },
        });
        expect(snapshot.dependencies?.fast.slots).toEqual({
            "dep:fast/counter:state": { committed: 1, tentative: 1 },
        });
    });
});

describe("persistent state snapshot restore", () => {
    it("rehydrates each runner's state slots from the structured shape", async () => {
        const store = inMemoryPersistentStateStore({ key: key() });

        const seed = createScriptRunner({
            compiled: bundleOf({
                primary: counterIndicator("primary"),
                siblings: [{ exportName: "slow", compiled: counterIndicator("slow") }],
                dependencies: [{ localId: "fast", compiled: counterIndicator("fast") }],
            }),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            now: () => 1,
        });
        for (let i = 0; i < 5; i += 1) {
            await seed.onBarClose(makeBar(i));
        }
        await seed.dispose();

        const observed: Array<Record<string, number>> = [];
        const primary = defineIndicator({
            name: "primary",
            apiVersion: 1,
            compute: ({ state }) => {
                const runtimeState = state as unknown as RuntimeStateNamespace;
                const counter = runtimeState.int("counter", 0);
                counter.value = counter.value + 1;
                observed.push({ scope: 0, value: counter.value });
            },
        });
        const slow = defineIndicator({
            name: "slow",
            apiVersion: 1,
            compute: ({ state }) => {
                const runtimeState = state as unknown as RuntimeStateNamespace;
                const counter = runtimeState.int("counter", 0);
                counter.value = counter.value + 1;
                observed.push({ scope: 1, value: counter.value });
            },
        });
        const fast = defineIndicator({
            name: "fast",
            apiVersion: 1,
            compute: ({ state }) => {
                const runtimeState = state as unknown as RuntimeStateNamespace;
                const counter = runtimeState.int("counter", 0);
                counter.value = counter.value + 1;
                observed.push({ scope: 2, value: counter.value });
            },
        });

        const warm = createScriptRunner({
            compiled: bundleOf({
                primary,
                siblings: [{ exportName: "slow", compiled: slow }],
                dependencies: [{ localId: "fast", compiled: fast }],
            }),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
        });
        await warm.warmStart(makeBar(5).time);
        await warm.onBarClose(makeBar(5));

        const last = observed.slice(-3);
        expect(last).toEqual([
            { scope: 2, value: 6 },
            { scope: 1, value: 6 },
            { scope: 0, value: 6 },
        ]);
    });

    it("rehydrates the primary from a legacy flat-shape snapshot", async () => {
        const flatSnapshot = {
            lastBarTime: 1_700_000_000_000,
            streams: {},
            slots: { "counter:state": { committed: 13, tentative: 13 } },
            savedAt: 1,
            snapshotVersion: 1,
        };
        const store: PersistentStateStore = {
            key: key(),
            async load() {
                return flatSnapshot as unknown as StateSnapshot;
            },
            async save() {},
            async clear() {},
        };

        const observed: number[] = [];
        const compiled = defineIndicator({
            name: "primary",
            apiVersion: 1,
            compute: ({ state }) => {
                const runtimeState = state as unknown as RuntimeStateNamespace;
                const counter = runtimeState.int("counter", 0);
                counter.value = counter.value + 1;
                observed.push(counter.value);
            },
        });
        const warm = createScriptRunner({
            compiled: withLookback(compiled),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
        });
        await warm.warmStart(makeBar(1).time);
        await warm.onBarClose(makeBar(1));

        expect(observed).toEqual([14]);
    });

    it("drops unknown sibling sections with a state-snapshot-malformed diagnostic", async () => {
        const store: PersistentStateStore = {
            key: key(),
            async load() {
                return {
                    lastBarTime: 1_700_000_000_000,
                    streams: {},
                    savedAt: 1,
                    snapshotVersion: 1,
                    primary: { slots: {} },
                    siblings: {
                        ghost: {
                            slots: { "export:ghost/x:state": { committed: 1, tentative: 1 } },
                        },
                    },
                };
            },
            async save() {},
            async clear() {},
        };
        const warm = createScriptRunner({
            compiled: withLookback(counterIndicator("primary")),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
        });
        await warm.warmStart(makeBar(1).time);

        const diagnostics = warm.drain().diagnostics;
        expect(diagnostics.map((d) => d.code)).toEqual([
            "state-snapshot-malformed",
            "state-snapshot-restored",
        ]);
        expect(diagnostics[0]?.message).toMatch(/unknown sibling "ghost"/);
    });

    it("drops unknown dependency sections with a state-snapshot-malformed diagnostic", async () => {
        const store: PersistentStateStore = {
            key: key(),
            async load() {
                return {
                    lastBarTime: 1_700_000_000_000,
                    streams: {},
                    savedAt: 1,
                    snapshotVersion: 1,
                    primary: { slots: {} },
                    dependencies: {
                        ghost: { slots: { "dep:ghost/x:state": { committed: 1, tentative: 1 } } },
                    },
                };
            },
            async save() {},
            async clear() {},
        };
        const warm = createScriptRunner({
            compiled: withLookback(counterIndicator("primary")),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
        });
        await warm.warmStart(makeBar(1).time);

        const diagnostics = warm.drain().diagnostics;
        expect(diagnostics.map((d) => d.code)).toEqual([
            "state-snapshot-malformed",
            "state-snapshot-restored",
        ]);
        expect(diagnostics[0]?.message).toMatch(/unknown dependency "ghost"/);
    });
});
