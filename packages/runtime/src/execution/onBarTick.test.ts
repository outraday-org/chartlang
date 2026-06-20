// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar } from "@invinite-org/chartlang-core";
import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "../createScriptRunner.js";
import { ACTIVE_RUNTIME_CONTEXT } from "../runtimeContext.js";

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
        maxLookback: 5000,
        maxTickHz: 10,
    };
}

function makeBar(i: number, overrides: Partial<Bar> = {}): Bar {
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open: 100 + i,
        high: 101 + i,
        low: 99 + i,
        close: 100.5 + i,
        volume: 1000 + i,
        symbol: "AAPL",
        interval: "1m",
        ...overrides,
    };
}

const arbBar = fc.record({
    time: fc.integer({ min: 1, max: 2_000_000_000_000 }),
    open: fc.double({ min: 1, max: 100_000, noNaN: true, noDefaultInfinity: true }),
    high: fc.double({ min: 1, max: 100_000, noNaN: true, noDefaultInfinity: true }),
    low: fc.double({ min: 1, max: 100_000, noNaN: true, noDefaultInfinity: true }),
    close: fc.double({ min: 1, max: 100_000, noNaN: true, noDefaultInfinity: true }),
    volume: fc.double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true }),
    symbol: fc.constantFrom("AAPL", "MSFT"),
    interval: fc.constantFrom("1m", "5m"),
});

describe("onBarTick — head replacement (no length advance)", () => {
    it("replaces head slot but does not advance length on close-side buffers", async () => {
        const beforeTick: Record<string, number> = {};
        const afterTick: Record<string, number> = {};
        const seenIsTick: boolean[] = [];
        const compiled = defineIndicator({
            name: "tick",
            apiVersion: 1,
            compute: () => {
                const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                if (!ctx) return;
                seenIsTick.push(ctx.isTick);
                const lens = {
                    time: ctx.stream.ohlcv.time.length,
                    open: ctx.stream.ohlcv.open.length,
                    high: ctx.stream.ohlcv.high.length,
                    low: ctx.stream.ohlcv.low.length,
                    close: ctx.stream.ohlcv.close.length,
                    volume: ctx.stream.ohlcv.volume.length,
                };
                if (seenIsTick.length === 1) Object.assign(beforeTick, lens);
                else Object.assign(afterTick, lens);
            },
        });
        const runner = createScriptRunner({
            compiled: { ...compiled, manifest: { ...compiled.manifest, maxLookback: 5 } },
            capabilities: makeCapabilities(),
        });
        await runner.onBarClose(makeBar(0));
        await runner.onBarTick(makeBar(0, { close: 200 }));
        expect(seenIsTick).toEqual([false, true]);
        expect(beforeTick).toEqual(afterTick);
    });

    it("does NOT touch time and open buffers on tick", async () => {
        let preTickTime = 0;
        let preTickOpen = 0;
        let tickTime = 0;
        let tickOpen = 0;
        let phase: "close" | "tick" = "close";
        const compiled = defineIndicator({
            name: "tick",
            apiVersion: 1,
            compute: () => {
                const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                if (!ctx) return;
                if (phase === "close") {
                    preTickTime = ctx.stream.bar.time;
                    preTickOpen = ctx.stream.bar.open.current;
                } else {
                    tickTime = ctx.stream.bar.time;
                    tickOpen = ctx.stream.bar.open.current;
                }
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await runner.onBarClose(makeBar(0));
        phase = "tick";
        await runner.onBarTick(makeBar(99, { time: 999_999, open: 999, close: 555 }));
        // bar.time and bar.open must NOT be updated by tick.
        expect(tickTime).toBe(preTickTime);
        expect(tickOpen).toBe(preTickOpen);
    });

    it("updates close / high / low / volume / derived sources on bar view", async () => {
        const snapshot: Record<string, number> = {};
        let phase: "close" | "tick" = "close";
        const compiled = defineIndicator({
            name: "tick",
            apiVersion: 1,
            compute: () => {
                if (phase !== "tick") return;
                const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                if (!ctx) return;
                const { bar } = ctx.stream;
                snapshot.close = bar.close.current;
                snapshot.high = bar.high.current;
                snapshot.low = bar.low.current;
                snapshot.volume = bar.volume.current;
                snapshot.hl2 = bar.hl2.current;
                snapshot.hlc3 = bar.hlc3.current;
                snapshot.ohlc4 = bar.ohlc4.current;
                snapshot.hlcc4 = bar.hlcc4.current;
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await runner.onBarClose(makeBar(0));
        phase = "tick";
        const tickBar = makeBar(0, {
            open: 100,
            high: 120,
            low: 80,
            close: 110,
            volume: 5000,
        });
        await runner.onBarTick(tickBar);
        expect(snapshot.close).toBe(110);
        expect(snapshot.high).toBe(120);
        expect(snapshot.low).toBe(80);
        expect(snapshot.volume).toBe(5000);
        expect(snapshot.hl2).toBe((120 + 80) / 2);
        expect(snapshot.hlc3).toBe((120 + 80 + 110) / 3);
        expect(snapshot.ohlc4).toBe((100 + 120 + 80 + 110) / 4);
        expect(snapshot.hlcc4).toBe((120 + 80 + 110 + 110) / 4);
    });

    it("resets isTick to false even when compute throws, and clears the slot", async () => {
        const compiled = defineIndicator({
            name: "throws",
            apiVersion: 1,
            compute: () => {
                throw new Error("tick boom");
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await expect(runner.onBarTick(makeBar(0))).rejects.toThrow("tick boom");
        expect(ACTIVE_RUNTIME_CONTEXT.current).toBeNull();
    });

    it("does NOT advance state.barIndex (the runtime's bar counter)", async () => {
        const seen: number[] = [];
        const compiled = defineIndicator({
            name: "tick",
            apiVersion: 1,
            compute: () => {
                const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                if (ctx) seen.push(ctx.barIndex());
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await runner.onBarClose(makeBar(0));
        await runner.onBarTick(makeBar(0));
        await runner.onBarTick(makeBar(0));
        await runner.onBarTick(makeBar(0));
        expect(seen).toEqual([0, 1, 1, 1]);
    });

    it("clears emission queues at tick start", async () => {
        const states: number[] = [];
        const compiled = defineIndicator({
            name: "tick",
            apiVersion: 1,
            compute: () => {
                const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                if (ctx) states.push(ctx.emissions.plots.length);
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await runner.onBarClose(makeBar(0));
        await runner.onBarTick(makeBar(0));
        expect(states).toEqual([0, 0]);
    });
});

describe("onBarTick — §6.7 invariant 3 (consecutive ticks don't advance length)", () => {
    it("two consecutive ticks without an intervening close don't advance length", async () => {
        await fc.assert(
            fc.asyncProperty(arbBar, arbBar, arbBar, async (closeBar, tick1, tick2) => {
                const lengths: number[] = [];
                const compiled = defineIndicator({
                    name: "inv3",
                    apiVersion: 1,
                    compute: () => {
                        const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                        if (!ctx) return;
                        lengths.push(ctx.stream.ohlcv.close.length);
                    },
                });
                const runner = createScriptRunner({
                    compiled: {
                        ...compiled,
                        manifest: { ...compiled.manifest, maxLookback: 5 },
                    },
                    capabilities: makeCapabilities(),
                });
                await runner.onBarClose(closeBar);
                await runner.onBarTick(tick1);
                await runner.onBarTick(tick2);
                runner.dispose();
                return lengths[0] === lengths[1] && lengths[1] === lengths[2];
            }),
            { numRuns: 25 },
        );
    });
});
