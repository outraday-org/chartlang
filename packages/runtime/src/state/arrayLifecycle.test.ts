// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar, MutableArraySlot, StateStoreKey } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "../createScriptRunner.js";
import { inMemoryPersistentStateStore } from "../persistentStateStore.js";

/** Runtime view of `state.array` — the compiler injects `slotId` first. */
type RuntimeArrayNamespace = {
    readonly array: (slotId: string, capacity: number) => MutableArraySlot<number>;
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

describe("state.array lifecycle", () => {
    it("accumulates one push per close and FIFO-evicts at capacity", async () => {
        const observed: Array<{ newest: number; size: number; oldest: number }> = [];
        const compiled = withCaps(
            defineIndicator({
                name: "array-window",
                apiVersion: 1,
                compute: ({ bar, state }) => {
                    const ns = state as unknown as RuntimeArrayNamespace;
                    const a = ns.array("a", 3);
                    a.push(bar.close.current);
                    observed.push({
                        newest: a.get(0),
                        size: a.size,
                        oldest: a.get(a.size - 1),
                    });
                },
            }),
            50,
        );
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        for (const [i, c] of [10, 20, 30, 40].entries()) {
            await runner.onBarClose(makeBar(i, c));
        }
        await runner.dispose();

        // The allocation bar already holds its push (no pre-advance): size 1.
        expect(observed[0]).toEqual({ newest: 10, size: 1, oldest: 10 });
        expect(observed[1]).toEqual({ newest: 20, size: 2, oldest: 10 });
        expect(observed[2]).toEqual({ newest: 30, size: 3, oldest: 10 });
        // Capacity 3: the 4th push evicts the oldest (10).
        expect(observed[3]).toEqual({ newest: 40, size: 3, oldest: 20 });
    });

    it("a bar that pushes twice grows size by two (multi-value per bar)", async () => {
        const observedSizes: number[] = [];
        const compiled = withCaps(
            defineIndicator({
                name: "array-multi",
                apiVersion: 1,
                compute: ({ bar, state }) => {
                    const ns = state as unknown as RuntimeArrayNamespace;
                    const a = ns.array("a", 10);
                    a.push(bar.close.current);
                    a.push(bar.close.current + 0.5);
                    observedSizes.push(a.size);
                },
            }),
            50,
        );
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await runner.onBarClose(makeBar(0, 10));
        await runner.onBarClose(makeBar(1, 20));
        await runner.dispose();

        // size reflects pushes (2 per bar), not bars.
        expect(observedSizes).toEqual([2, 4]);
    });

    it("a head-replacing tick discards in-progress pushes; close commits the final state", async () => {
        const observed: Array<{ newest: number; size: number }> = [];
        const compiled = withCaps(
            defineIndicator({
                name: "array-tick",
                apiVersion: 1,
                compute: ({ bar, state }) => {
                    const ns = state as unknown as RuntimeArrayNamespace;
                    const a = ns.array("a", 5);
                    a.push(bar.close.current);
                    observed.push({ newest: a.get(0), size: a.size });
                },
            }),
            50,
        );
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await runner.onBarClose(makeBar(0, 10)); // committed: [10]
        observed.length = 0;

        // Tick 1 pushes 20 onto a fresh in-progress bar → tentative [10, 20].
        await runner.onBarTick(makeBar(1, 20));
        expect(observed[0]).toEqual({ newest: 20, size: 2 });

        // Tick 2 replaces the head bar: onBarTick rolls back to committed [10],
        // then this tick pushes 30 → tentative [10, 30] (the 20 is discarded).
        await runner.onBarTick(makeBar(1, 30));
        expect(observed[1]).toEqual({ newest: 30, size: 2 });

        // Close runs compute once more on this bar (pushing a 3rd value onto
        // the tick-rolled-back tentative [10, 30]) and commits → [10, 30, 30].
        await runner.onBarClose(makeBar(1, 30));
        expect(observed[2]).toEqual({ newest: 30, size: 3 });

        await runner.dispose();
    });
});

describe("state.array snapshot / restore", () => {
    it("warm restart restores size and element order", async () => {
        const store = inMemoryPersistentStateStore({ key: key() });
        function build(name: string): ReturnType<typeof defineIndicator> {
            return withCaps(
                defineIndicator({
                    name,
                    apiVersion: 1,
                    compute: ({ bar, state }) => {
                        const ns = state as unknown as RuntimeArrayNamespace;
                        const a = ns.array("a", 4);
                        a.push(bar.close.current);
                    },
                }),
                50,
            );
        }
        const seed = createScriptRunner({
            compiled: build("array-snap"),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            now: () => 1,
        });
        for (const [i, c] of [10, 20, 30].entries()) {
            await seed.onBarClose(makeBar(i, c));
        }
        await seed.dispose();

        const observed: Array<{ newest: number; older: number; size: number }> = [];
        const warm = createScriptRunner({
            compiled: withCaps(
                defineIndicator({
                    name: "array-snap-observe",
                    apiVersion: 1,
                    compute: ({ bar, state }) => {
                        const ns = state as unknown as RuntimeArrayNamespace;
                        const a = ns.array("a", 4);
                        a.push(bar.close.current);
                        observed.push({ newest: a.get(0), older: a.get(1), size: a.size });
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

        // Restored [10,20,30] then bar-3 push 40 → [10,20,30,40], size 4.
        expect(observed[0]).toEqual({ newest: 40, older: 30, size: 4 });
    });

    it("restores bundle dep array slots into their prefixed :array key", async () => {
        const store = inMemoryPersistentStateStore({ key: key() });
        function makeScript(name: string): ReturnType<typeof defineIndicator> {
            return withCaps(
                defineIndicator({
                    name,
                    apiVersion: 1,
                    compute: ({ bar, state }) => {
                        const ns = state as unknown as RuntimeArrayNamespace;
                        const a = ns.array("a", 4);
                        a.push(bar.close.current);
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
                                const ns = state as unknown as RuntimeArrayNamespace;
                                const a = ns.array("a", 4);
                                a.push(bar.close.current);
                                observed.push(a.size);
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

        // The dep runner's restored array slot had 3 elements; +1 this bar = 4.
        expect(observed[0]).toBe(4);
    });
});
