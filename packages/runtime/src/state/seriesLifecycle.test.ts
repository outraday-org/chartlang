// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar, NumberSeriesSlot, StateStoreKey } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "../createScriptRunner.js";
import { inMemoryPersistentStateStore } from "../persistentStateStore.js";

/** Runtime view of `state.series` — the compiler injects `slotId` first. */
type RuntimeSeriesNamespace = {
    readonly series: (slotId: string, init: number) => NumberSeriesSlot;
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

describe("state.series lifecycle", () => {
    it("s[1] is the prior committed close; length grows one per close", async () => {
        const observed: Array<{ cur: number; prev: number; len: number }> = [];
        const compiled = withCaps(
            defineIndicator({
                name: "series-basic",
                apiVersion: 1,
                compute: ({ bar, state }) => {
                    const ns = state as unknown as RuntimeSeriesNamespace;
                    const s = ns.series("s", 0);
                    s.value = bar.close.current;
                    observed.push({ cur: s.current, prev: s[1], len: s.length });
                },
            }),
            50,
        );
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        const closes = [10, 20, 30, 40];
        for (let i = 0; i < closes.length; i += 1) {
            await runner.onBarClose(makeBar(i, closes[i]));
        }
        await runner.dispose();

        // Allocation bar: length 1 (NOT 2 — the loop hook does not advance the
        // freshly-seeded slot on its allocation bar).
        expect(observed[0]).toEqual({ cur: 10, prev: Number.NaN, len: 1 });
        expect(observed[1]).toEqual({ cur: 20, prev: 10, len: 2 });
        expect(observed[2]).toEqual({ cur: 30, prev: 20, len: 3 });
        expect(observed[3]).toEqual({ cur: 40, prev: 30, len: 4 });
    });

    it("an unwritten bar leaves a NaN head gap while s[1] keeps the committed value", async () => {
        const observed: Array<{ cur: number; prev: number }> = [];
        const compiled = withCaps(
            defineIndicator({
                name: "series-gap",
                apiVersion: 1,
                compute: ({ bar, state }) => {
                    const ns = state as unknown as RuntimeSeriesNamespace;
                    const s = ns.series("s", 0);
                    // Skip the write on the 3rd bar (close === 30) → NaN gap.
                    if (bar.close.current !== 30) s.value = bar.close.current;
                    observed.push({ cur: s.current, prev: s[1] });
                },
            }),
            50,
        );
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        for (const [i, c] of [10, 20, 30, 40].entries()) {
            await runner.onBarClose(makeBar(i, c));
        }
        await runner.dispose();

        expect(observed[1]).toEqual({ cur: 20, prev: 10 });
        // Gap bar: head is NaN; s[1] still reads the prior committed close.
        expect(observed[2].cur).toBeNaN();
        expect(observed[2].prev).toBe(20);
        // Next bar: the gap committed as NaN, so s[1] is NaN; s[2] is 20.
        expect(observed[3].cur).toBe(40);
        expect(observed[3].prev).toBeNaN();
    });

    it("reads out-of-history offsets as NaN and retains >= maxLookback+1 values", async () => {
        const observed: Array<number> = [];
        const compiled = withCaps(
            defineIndicator({
                name: "series-capacity",
                apiVersion: 1,
                compute: ({ bar, state }) => {
                    const ns = state as unknown as RuntimeSeriesNamespace;
                    const s = ns.series("s", 0);
                    s.value = bar.close.current;
                    observed.push(s[3]);
                },
            }),
            // maxLookback 3 ⇒ ring capacity 4 ⇒ s[3] reachable once warm.
            3,
        );
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities(3) });
        for (const [i, c] of [10, 20, 30, 40, 50].entries()) {
            await runner.onBarClose(makeBar(i, c));
        }
        await runner.dispose();

        expect(observed[2]).toBeNaN(); // bar 2: only 3 filled, s[3] OOR
        expect(observed[3]).toBe(10); // bar 3: s[3] === first close
        expect(observed[4]).toBe(20); // bar 4: s[3] === second close (ring kept 4)
    });

    it("a tick refines s[0] without advancing length; an unwritten tick reads committed", async () => {
        const observed: Array<{ cur: number; prev: number; len: number }> = [];
        let writeOnTick = true;
        const compiled = withCaps(
            defineIndicator({
                name: "series-tick",
                apiVersion: 1,
                compute: ({ bar, state }) => {
                    const ns = state as unknown as RuntimeSeriesNamespace;
                    const s = ns.series("s", 0);
                    if (writeOnTick) s.value = bar.close.current;
                    observed.push({ cur: s.current, prev: s[1], len: s.length });
                },
            }),
            50,
        );
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await runner.onBarClose(makeBar(0, 10));
        await runner.onBarClose(makeBar(1, 20));
        observed.length = 0;

        // Tick that writes: refines s[0] to 25, s[1] stays committed 10, length 2.
        await runner.onBarTick(makeBar(1, 25));
        expect(observed[0]).toEqual({ cur: 25, prev: 10, len: 2 });

        // Tick that does NOT write: head resets to the committed 20.
        writeOnTick = false;
        await runner.onBarTick(makeBar(1, 99));
        expect(observed[1]).toEqual({ cur: 20, prev: 10, len: 2 });

        await runner.dispose();
    });
});

describe("state.series snapshot / restore", () => {
    it("warm restart restores s[1] and s.length", async () => {
        const store = inMemoryPersistentStateStore({ key: key() });
        function build(): ReturnType<typeof defineIndicator> {
            return withCaps(
                defineIndicator({
                    name: "series-snap",
                    apiVersion: 1,
                    compute: ({ bar, state }) => {
                        const ns = state as unknown as RuntimeSeriesNamespace;
                        const s = ns.series("s", 0);
                        s.value = bar.close.current;
                    },
                }),
                50,
            );
        }
        const seed = createScriptRunner({
            compiled: build(),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            now: () => 1,
        });
        for (const [i, c] of [10, 20, 30].entries()) {
            await seed.onBarClose(makeBar(i, c));
        }
        await seed.dispose();

        const observed: Array<{ prev: number; prev2: number; len: number }> = [];
        const warm = createScriptRunner({
            compiled: build(),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            now: () => 2,
        });
        await warm.warmStart(makeBar(3, 40).time);
        const warmCompiled = withCaps(
            defineIndicator({
                name: "series-snap-observe",
                apiVersion: 1,
                compute: ({ bar, state }) => {
                    const ns = state as unknown as RuntimeSeriesNamespace;
                    const s = ns.series("s", 0);
                    s.value = bar.close.current;
                    observed.push({ prev: s[1], prev2: s[2], len: s.length });
                },
            }),
            50,
        );
        const warm2 = createScriptRunner({
            compiled: warmCompiled,
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            now: () => 3,
        });
        await warm2.warmStart(makeBar(3, 40).time);
        await warm2.onBarClose(makeBar(3, 40));
        await warm2.dispose();
        await warm.dispose();

        // After restore, the bar-3 close sees s[1]=30 (last seeded close),
        // s[2]=20, and the length grew past the restored 3.
        expect(observed[0].prev).toBe(30);
        expect(observed[0].prev2).toBe(20);
        expect(observed[0].len).toBe(4);
    });

    it("restores bundle dep + sibling series slots into their prefixed keys", async () => {
        const store = inMemoryPersistentStateStore({ key: key() });
        function makeScript(name: string): ReturnType<typeof defineIndicator> {
            return withCaps(
                defineIndicator({
                    name,
                    apiVersion: 1,
                    compute: ({ bar, state }) => {
                        const ns = state as unknown as RuntimeSeriesNamespace;
                        const s = ns.series("s", 0);
                        s.value = bar.close.current;
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

        const observed: Array<number> = [];
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
                                const ns = state as unknown as RuntimeSeriesNamespace;
                                const s = ns.series("s", 0);
                                s.value = bar.close.current;
                                observed.push(s[1]);
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

        // The dep runner's restored series slot reads the prior committed close.
        expect(observed[0]).toBe(30);
    });
});
