// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar, MutableMapSlot, StateStoreKey } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "../createScriptRunner.js";
import { inMemoryPersistentStateStore } from "../persistentStateStore.js";

/** Runtime view of `state.map` — the compiler injects `slotId` first. */
type RuntimeMapNamespace = {
    readonly map: (slotId: string, capacity: number) => MutableMapSlot<number, number>;
};

function makeCapabilities(maxLookback = 50): Capabilities {
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
        maxLookback,
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

function makeBar(i: number, close: number): Bar {
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open: close,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1_000 + i,
        symbol: "AAPL",
        interval: "1m",
    };
}

function withCaps<T extends ReturnType<typeof defineIndicator>>(
    compiled: T,
    maxLookback: number,
): T {
    return { ...compiled, manifest: { ...compiled.manifest, maxLookback } };
}

describe("state.map lifecycle", () => {
    it("accumulates one key per close and FIFO-evicts at capacity", async () => {
        const observed: Array<{ size: number; oldest: number | undefined }> = [];
        const compiled = withCaps(
            defineIndicator({
                name: "map-window",
                apiVersion: 1,
                compute: ({ bar, state }) => {
                    const ns = state as unknown as RuntimeMapNamespace;
                    const m = ns.map("m", 3);
                    m.set(bar.close.current, bar.volume.current);
                    observed.push({ size: m.size, oldest: m.keyAt(0) });
                },
            }),
            50,
        );
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        for (const [i, c] of [10, 20, 30, 40].entries()) {
            await runner.onBarClose(makeBar(i, c));
        }
        await runner.dispose();

        expect(observed[0]).toEqual({ size: 1, oldest: 10 });
        expect(observed[1]).toEqual({ size: 2, oldest: 10 });
        expect(observed[2]).toEqual({ size: 3, oldest: 10 });
        // Capacity 3: the 4th distinct key evicts the oldest (10).
        expect(observed[3]).toEqual({ size: 3, oldest: 20 });
    });

    it("a head-replacing tick discards in-progress sets; close commits the final state", async () => {
        const observed: Array<{ size: number; has20: boolean; has30: boolean }> = [];
        const compiled = withCaps(
            defineIndicator({
                name: "map-tick",
                apiVersion: 1,
                compute: ({ bar, state }) => {
                    const ns = state as unknown as RuntimeMapNamespace;
                    const m = ns.map("m", 5);
                    m.set(bar.close.current, 1);
                    observed.push({
                        size: m.size,
                        has20: m.has(20),
                        has30: m.has(30),
                    });
                },
            }),
            50,
        );
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await runner.onBarClose(makeBar(0, 10)); // committed: {10}
        observed.length = 0;

        // Tick 1 sets key 20 onto a fresh in-progress bar → tentative {10, 20}.
        await runner.onBarTick(makeBar(1, 20));
        expect(observed[0]).toEqual({ size: 2, has20: true, has30: false });

        // Tick 2 replaces the head: rolls back to committed {10}, then sets 30
        // → tentative {10, 30} (the 20 is discarded).
        await runner.onBarTick(makeBar(1, 30));
        expect(observed[1]).toEqual({ size: 2, has20: false, has30: true });

        // Close commits {10, 30}.
        await runner.onBarClose(makeBar(1, 30));
        expect(observed[2]).toEqual({ size: 2, has20: false, has30: true });

        await runner.dispose();
    });
});

describe("state.map snapshot / restore", () => {
    it("warm restart restores keys, values, and insertion order", async () => {
        const store = inMemoryPersistentStateStore({ key: key() });
        function build(name: string): ReturnType<typeof defineIndicator> {
            return withCaps(
                defineIndicator({
                    name,
                    apiVersion: 1,
                    compute: ({ bar, state }) => {
                        const ns = state as unknown as RuntimeMapNamespace;
                        const m = ns.map("m", 4);
                        m.set(bar.close.current, bar.volume.current);
                    },
                }),
                50,
            );
        }
        const seed = createScriptRunner({
            compiled: build("map-snap"),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            now: () => 1,
        });
        for (const [i, c] of [10, 20, 30].entries()) {
            await seed.onBarClose(makeBar(i, c));
        }
        await seed.dispose();

        const observed: Array<{
            size: number;
            oldest: number | undefined;
            v10: number | undefined;
        }> = [];
        const warm = createScriptRunner({
            compiled: withCaps(
                defineIndicator({
                    name: "map-snap-observe",
                    apiVersion: 1,
                    compute: ({ bar, state }) => {
                        const ns = state as unknown as RuntimeMapNamespace;
                        const m = ns.map("m", 4);
                        m.set(bar.close.current, bar.volume.current);
                        observed.push({ size: m.size, oldest: m.keyAt(0), v10: m.get(10) });
                    },
                }),
                50,
            ),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            now: () => 2,
        });
        await warm.warmStart(makeBar(3, 40).time);
        await warm.onBarClose(makeBar(3, 40));
        await warm.dispose();

        // Restored {10,20,30} then bar-3 set 40 → keys [10,20,30,40], size 4.
        expect(observed[0]?.size).toBe(4);
        expect(observed[0]?.oldest).toBe(10);
        expect(observed[0]?.v10).toBe(1_000);
    });

    it("restores bundle dep map slots into their prefixed :map key", async () => {
        const store = inMemoryPersistentStateStore({ key: key() });
        function makeScript(name: string): ReturnType<typeof defineIndicator> {
            return withCaps(
                defineIndicator({
                    name,
                    apiVersion: 1,
                    compute: ({ bar, state }) => {
                        const ns = state as unknown as RuntimeMapNamespace;
                        const m = ns.map("m", 4);
                        m.set(bar.close.current, bar.volume.current);
                    },
                }),
                50,
            );
        }
        const bundle = {
            primary: makeScript("bundle-primary"),
            siblings: [{ exportName: "slow", compiled: makeScript("bundle-slow") }],
            dependencies: [{ localId: "fast", compiled: makeScript("bundle-fast") }],
        };
        const seed = createScriptRunner({
            compiled: bundle,
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            now: () => 1,
        });
        for (const [i, c] of [10, 20, 30].entries()) {
            await seed.onBarClose(makeBar(i, c));
        }
        await seed.dispose();

        const observed: number[] = [];
        const observeBundle = {
            primary: makeScript("bundle-primary"),
            siblings: [{ exportName: "slow", compiled: makeScript("bundle-slow") }],
            dependencies: [
                {
                    localId: "fast",
                    compiled: withCaps(
                        defineIndicator({
                            name: "bundle-fast",
                            apiVersion: 1,
                            compute: ({ bar, state }) => {
                                const ns = state as unknown as RuntimeMapNamespace;
                                const m = ns.map("m", 4);
                                m.set(bar.close.current, bar.volume.current);
                                observed.push(m.size);
                            },
                        }),
                        50,
                    ),
                },
            ],
        };
        const warm = createScriptRunner({
            compiled: observeBundle,
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            now: () => 2,
        });
        await warm.warmStart(makeBar(3, 40).time);
        await warm.onBarClose(makeBar(3, 40));
        await warm.dispose();

        // The dep runner's restored map slot had 3 keys; +1 this bar = 4.
        expect(observed[0]).toBe(4);
    });
});
