// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { defineIndicator } from "@invinite-org/chartlang-core";
import type {
    Bar,
    BoolSeriesSlot,
    Color,
    MutableSlot,
    StateStoreKey,
    StringSeriesSlot,
} from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "../createScriptRunner.js";
import { inMemoryPersistentStateStore } from "../persistentStateStore.js";

/** Runtime view of the non-numeric `state.*` factories — slotId injected first. */
type RuntimeObjectNamespace = {
    readonly boolSeries: (slotId: string, init: boolean) => BoolSeriesSlot;
    readonly stringSeries: (slotId: string, init: string) => StringSeriesSlot;
    readonly color: (slotId: string, init: Color) => MutableSlot<Color>;
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

describe("state.boolSeries lifecycle", () => {
    it("s[1] is the prior committed flag; first-bar history is false (not NaN)", async () => {
        const observed: Array<{ cur: boolean; prev: boolean; len: number }> = [];
        const compiled = withCaps(
            defineIndicator({
                name: "boolseries-basic",
                apiVersion: 1,
                compute: ({ bar, state }) => {
                    const ns = state as unknown as RuntimeObjectNamespace;
                    const s = ns.boolSeries("s", false);
                    s.value = bar.close.current > 25;
                    observed.push({ cur: s.current, prev: s[1], len: s.length });
                },
            }),
            50,
        );
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        for (const [i, c] of [10, 20, 30, 40].entries()) {
            await runner.onBarClose(makeBar(i, c));
        }
        await runner.dispose();

        // Allocation bar: length 1, first-bar s[1] is the v6 default `false`.
        expect(observed[0]).toEqual({ cur: false, prev: false, len: 1 });
        expect(observed[1]).toEqual({ cur: false, prev: false, len: 2 });
        expect(observed[2]).toEqual({ cur: true, prev: false, len: 3 });
        expect(observed[3]).toEqual({ cur: true, prev: true, len: 4 });
    });

    it("a tick refines s[0] without advancing length; an unwritten tick reads committed", async () => {
        const observed: Array<{ cur: boolean; len: number }> = [];
        let writeOnTick = true;
        const compiled = withCaps(
            defineIndicator({
                name: "boolseries-tick",
                apiVersion: 1,
                compute: ({ bar, state }) => {
                    const ns = state as unknown as RuntimeObjectNamespace;
                    const s = ns.boolSeries("s", false);
                    if (writeOnTick) s.value = bar.close.current > 15;
                    observed.push({ cur: s.current, len: s.length });
                },
            }),
            50,
        );
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await runner.onBarClose(makeBar(0, 10)); // false
        await runner.onBarClose(makeBar(1, 20)); // true
        observed.length = 0;

        await runner.onBarTick(makeBar(1, 10)); // refine head to false
        expect(observed[0]).toEqual({ cur: false, len: 2 });

        writeOnTick = false;
        await runner.onBarTick(makeBar(1, 99)); // head resets to committed true
        expect(observed[1]).toEqual({ cur: true, len: 2 });

        await runner.dispose();
    });
});

describe("state.stringSeries lifecycle", () => {
    it("s[1] is the prior committed string; out-of-history reads are ''", async () => {
        const observed: Array<{ prev: string; prev3: string }> = [];
        const compiled = withCaps(
            defineIndicator({
                name: "stringseries-basic",
                apiVersion: 1,
                compute: ({ bar, state }) => {
                    const ns = state as unknown as RuntimeObjectNamespace;
                    const s = ns.stringSeries("s", "");
                    s.value = `c${bar.close.current}`;
                    observed.push({ prev: s[1], prev3: s[3] });
                },
            }),
            50,
        );
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        for (const [i, c] of [10, 20, 30].entries()) {
            await runner.onBarClose(makeBar(i, c));
        }
        await runner.dispose();

        expect(observed[0]).toEqual({ prev: "", prev3: "" }); // first bar: default
        expect(observed[1].prev).toBe("c10");
        expect(observed[2].prev).toBe("c20");
        expect(observed[2].prev3).toBe(""); // s[3] still out of history
    });
});

describe("state.color persistence", () => {
    it("persists across bars through the scalar slot path", async () => {
        const observed: string[] = [];
        const compiled = withCaps(
            defineIndicator({
                name: "color-persist",
                apiVersion: 1,
                compute: ({ bar, state }) => {
                    const ns = state as unknown as RuntimeObjectNamespace;
                    const c = ns.color("c", "#000000");
                    // Only the first bar writes; later bars must read the retained value.
                    if (bar.close.current === 10) c.value = "#22c55e";
                    observed.push(c.value);
                },
            }),
            50,
        );
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        for (const [i, c] of [10, 20, 30].entries()) {
            await runner.onBarClose(makeBar(i, c));
        }
        await runner.dispose();

        expect(observed).toEqual(["#22c55e", "#22c55e", "#22c55e"]);
    });
});

describe("non-numeric series snapshot / restore", () => {
    it("warm restart restores bool/string history and the color scalar", async () => {
        const store = inMemoryPersistentStateStore({ key: key() });
        function build(name: string): ReturnType<typeof defineIndicator> {
            return withCaps(
                defineIndicator({
                    name,
                    apiVersion: 1,
                    compute: ({ bar, state }) => {
                        const ns = state as unknown as RuntimeObjectNamespace;
                        ns.boolSeries("b", false).value = bar.close.current > 15;
                        ns.stringSeries("s", "").value = `c${bar.close.current}`;
                        const col = ns.color("col", "#000000");
                        if (bar.close.current === 10) col.value = "#22c55e";
                    },
                }),
                50,
            );
        }
        const seed = createScriptRunner({
            compiled: build("nonnum-seed"),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            now: () => 1,
        });
        for (const [i, c] of [10, 20, 30].entries()) {
            await seed.onBarClose(makeBar(i, c));
        }
        await seed.dispose();

        const observed: Array<{ boolPrev: boolean; strPrev: string; col: string }> = [];
        const warmCompiled = withCaps(
            defineIndicator({
                name: "nonnum-observe",
                apiVersion: 1,
                compute: ({ bar, state }) => {
                    const ns = state as unknown as RuntimeObjectNamespace;
                    const b = ns.boolSeries("b", false);
                    const s = ns.stringSeries("s", "");
                    const col = ns.color("col", "#000000");
                    b.value = bar.close.current > 15;
                    s.value = `c${bar.close.current}`;
                    observed.push({ boolPrev: b[1], strPrev: s[1], col: col.value });
                },
            }),
            50,
        );
        const warm = createScriptRunner({
            compiled: warmCompiled,
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            now: () => 2,
        });
        await warm.warmStart(makeBar(3, 40).time);
        await warm.onBarClose(makeBar(3, 40));
        await warm.dispose();

        // After restore the bar-3 close sees the prior committed bool (close 30 > 15
        // ⇒ true), the prior committed string "c30", and the retained color.
        expect(observed[0].boolPrev).toBe(true);
        expect(observed[0].strPrev).toBe("c30");
        expect(observed[0].col).toBe("#22c55e");
    });
});
