// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar, ComputeFn } from "@invinite-org/chartlang-core";
import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "../createScriptRunner";
import type { RunnerState } from "../createScriptRunner";
import { ACTIVE_RUNTIME_CONTEXT } from "../runtimeContext";

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
    symbol: fc.constantFrom("AAPL", "MSFT", "TSLA"),
    interval: fc.constantFrom("1m", "5m", "1D"),
});

function buildRunnerWithStateCapture(compute: ComputeFn): {
    runner: ReturnType<typeof createScriptRunner>;
    state: { value: RunnerState | null };
} {
    const captured: { value: RunnerState | null } = { value: null };
    const compiled = defineIndicator({
        name: "demo",
        apiVersion: 1,
        compute: (ctx) => {
            const current = ACTIVE_RUNTIME_CONTEXT.current;
            if (current !== null && captured.value === null) {
                // Capture the runtime state's stream / emissions by reading
                // through the context — we don't need the full RunnerState
                // for invariant checks, but the snapshot helps debugging.
                void current;
            }
            compute(ctx);
        },
    });
    const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
    return { runner, state: captured };
}

describe("onBarClose — step 1 (append every OHLCV buffer)", () => {
    it("advances the length of every OHLCV ring buffer by one", async () => {
        const lengths: Record<string, number> = {};
        const { runner } = buildRunnerWithStateCapture(() => {
            const stream = ACTIVE_RUNTIME_CONTEXT.current?.stream;
            if (!stream) throw new Error("no stream");
            lengths.time = stream.ohlcv.time.length;
            lengths.open = stream.ohlcv.open.length;
            lengths.high = stream.ohlcv.high.length;
            lengths.low = stream.ohlcv.low.length;
            lengths.close = stream.ohlcv.close.length;
            lengths.volume = stream.ohlcv.volume.length;
            lengths.hl2 = stream.ohlcv.hl2.length;
            lengths.hlc3 = stream.ohlcv.hlc3.length;
            lengths.ohlc4 = stream.ohlcv.ohlc4.length;
            lengths.hlcc4 = stream.ohlcv.hlcc4.length;
        });
        await runner.onBarClose(makeBar(0));
        expect(Object.values(lengths)).toEqual(Array(10).fill(1));
    });
});

describe("onBarClose — step 2 (mutate BarView)", () => {
    it("writes every BarView scalar from rawBar and derived math", async () => {
        const snapshot: Record<string, number | string> = {};
        const { runner } = buildRunnerWithStateCapture(() => {
            const stream = ACTIVE_RUNTIME_CONTEXT.current?.stream;
            if (!stream) throw new Error("no stream");
            const { bar } = stream;
            snapshot.time = bar.time;
            snapshot.open = bar.open;
            snapshot.high = bar.high;
            snapshot.low = bar.low;
            snapshot.close = bar.close;
            snapshot.volume = bar.volume;
            snapshot.hl2 = bar.hl2;
            snapshot.hlc3 = bar.hlc3;
            snapshot.ohlc4 = bar.ohlc4;
            snapshot.hlcc4 = bar.hlcc4;
            snapshot.symbol = bar.symbol;
            snapshot.interval = bar.interval;
        });
        const raw = makeBar(0, { high: 110, low: 90, open: 100, close: 105, volume: 2000 });
        await runner.onBarClose(raw);
        expect(snapshot.time).toBe(raw.time);
        expect(snapshot.open).toBe(100);
        expect(snapshot.high).toBe(110);
        expect(snapshot.low).toBe(90);
        expect(snapshot.close).toBe(105);
        expect(snapshot.volume).toBe(2000);
        expect(snapshot.hl2).toBe((110 + 90) / 2);
        expect(snapshot.hlc3).toBe((110 + 90 + 105) / 3);
        expect(snapshot.ohlc4).toBe((100 + 110 + 90 + 105) / 4);
        expect(snapshot.hlcc4).toBe((110 + 90 + 105 + 105) / 4);
        expect(snapshot.symbol).toBe("AAPL");
        expect(snapshot.interval).toBe("1m");
    });
});

describe("onBarClose — step 3 invariant (bar.X === series.X[0])", () => {
    it("the BarView matches series.current for every field after step 3", async () => {
        const matches: boolean[] = [];
        const { runner } = buildRunnerWithStateCapture(() => {
            const stream = ACTIVE_RUNTIME_CONTEXT.current?.stream;
            if (!stream) throw new Error("no stream");
            const { bar, seriesViews } = stream;
            matches.push(bar.time === seriesViews.time.current);
            matches.push(bar.open === seriesViews.open.current);
            matches.push(bar.high === seriesViews.high.current);
            matches.push(bar.low === seriesViews.low.current);
            matches.push(bar.close === seriesViews.close.current);
            matches.push(bar.volume === seriesViews.volume.current);
            matches.push(bar.hl2 === seriesViews.hl2.current);
            matches.push(bar.hlc3 === seriesViews.hlc3.current);
            matches.push(bar.ohlc4 === seriesViews.ohlc4.current);
            matches.push(bar.hlcc4 === seriesViews.hlcc4.current);
        });
        await runner.onBarClose(makeBar(0));
        expect(matches.every(Boolean)).toBe(true);
    });
});

describe("onBarClose — step 4 (emission queues cleared)", () => {
    it("resets all four queues at the start of every step", async () => {
        const queueStates: {
            plots: number;
            drawings: number;
            alerts: number;
            diagnostics: number;
        }[] = [];
        const { runner } = buildRunnerWithStateCapture(() => {
            const emissions = ACTIVE_RUNTIME_CONTEXT.current?.emissions;
            if (!emissions) throw new Error("no emissions");
            queueStates.push({
                plots: emissions.plots.length,
                drawings: emissions.drawings.length,
                alerts: emissions.alerts.length,
                diagnostics: emissions.diagnostics.length,
            });
        });
        await runner.onBarClose(makeBar(0));
        await runner.onBarClose(makeBar(1));
        expect(queueStates).toEqual([
            { plots: 0, drawings: 0, alerts: 0, diagnostics: 0 },
            { plots: 0, drawings: 0, alerts: 0, diagnostics: 0 },
        ]);
    });

    it("syncs fromBar / toBar to the current bar index at step start", async () => {
        const indices: { from: number; to: number }[] = [];
        const { runner } = buildRunnerWithStateCapture(() => {
            const emissions = ACTIVE_RUNTIME_CONTEXT.current?.emissions;
            if (!emissions) throw new Error("no emissions");
            indices.push({ from: emissions.fromBar, to: emissions.toBar });
        });
        await runner.onBarClose(makeBar(0));
        await runner.onBarClose(makeBar(1));
        await runner.onBarClose(makeBar(2));
        expect(indices).toEqual([
            { from: 0, to: 0 },
            { from: 1, to: 1 },
            { from: 2, to: 2 },
        ]);
    });
});

describe("onBarClose — step 5 (ACTIVE_RUNTIME_CONTEXT slot)", () => {
    it("sets the slot during compute and restores null after", async () => {
        let slotDuring: unknown = "unset";
        const { runner } = buildRunnerWithStateCapture(() => {
            slotDuring = ACTIVE_RUNTIME_CONTEXT.current;
        });
        expect(ACTIVE_RUNTIME_CONTEXT.current).toBeNull();
        await runner.onBarClose(makeBar(0));
        expect(slotDuring).not.toBeNull();
        expect(ACTIVE_RUNTIME_CONTEXT.current).toBeNull();
    });

    it("clears the slot even if compute throws", async () => {
        const compiled = defineIndicator({
            name: "throw",
            apiVersion: 1,
            compute: () => {
                throw new Error("boom");
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await expect(runner.onBarClose(makeBar(0))).rejects.toThrow("boom");
        expect(ACTIVE_RUNTIME_CONTEXT.current).toBeNull();
    });

    it("isTick is false during the close path", async () => {
        let isTick: boolean | "unset" = "unset";
        const { runner } = buildRunnerWithStateCapture(() => {
            const ctx = ACTIVE_RUNTIME_CONTEXT.current;
            if (ctx) isTick = ctx.isTick;
        });
        await runner.onBarClose(makeBar(0));
        expect(isTick).toBe(false);
    });
});

describe("onBarClose — step 6 (barIndex advances)", () => {
    it("the runtime's barIndex closure returns the live index every step", async () => {
        const seen: number[] = [];
        const { runner } = buildRunnerWithStateCapture(() => {
            const ctx = ACTIVE_RUNTIME_CONTEXT.current;
            if (ctx) seen.push(ctx.barIndex());
        });
        await runner.onBarClose(makeBar(0));
        await runner.onBarClose(makeBar(1));
        await runner.onBarClose(makeBar(2));
        expect(seen).toEqual([0, 1, 2]);
    });
});

describe("onBarClose — §6.7 property invariants", () => {
    it("invariant 1: bar.X === series.X[0] for every field over arbitrary bar sequences", async () => {
        await fc.assert(
            fc.asyncProperty(fc.array(arbBar, { minLength: 1, maxLength: 20 }), async (bars) => {
                const matches: boolean[] = [];
                const compiled = defineIndicator({
                    name: "inv1",
                    apiVersion: 1,
                    compute: () => {
                        const stream = ACTIVE_RUNTIME_CONTEXT.current?.stream;
                        if (!stream) return;
                        const { bar, seriesViews } = stream;
                        matches.push(bar.time === seriesViews.time.current);
                        matches.push(bar.open === seriesViews.open.current);
                        matches.push(bar.high === seriesViews.high.current);
                        matches.push(bar.low === seriesViews.low.current);
                        matches.push(bar.close === seriesViews.close.current);
                        matches.push(bar.volume === seriesViews.volume.current);
                        matches.push(bar.hl2 === seriesViews.hl2.current);
                        matches.push(bar.hlc3 === seriesViews.hlc3.current);
                        matches.push(bar.ohlc4 === seriesViews.ohlc4.current);
                        matches.push(bar.hlcc4 === seriesViews.hlcc4.current);
                    },
                });
                const runner = createScriptRunner({
                    compiled: { ...compiled, manifest: { ...compiled.manifest, maxLookback: 5 } },
                    capabilities: makeCapabilities(),
                });
                for (const bar of bars) await runner.onBarClose(bar);
                runner.dispose();
                return matches.every(Boolean);
            }),
            { numRuns: 25 },
        );
    });

    it("invariant 2: every OHLCV series has equal length after compute returns", async () => {
        await fc.assert(
            fc.asyncProperty(fc.array(arbBar, { minLength: 1, maxLength: 20 }), async (bars) => {
                const lengths: number[][] = [];
                const compiled = defineIndicator({
                    name: "inv2",
                    apiVersion: 1,
                    compute: () => {
                        const stream = ACTIVE_RUNTIME_CONTEXT.current?.stream;
                        if (!stream) return;
                        const lens = [
                            stream.ohlcv.time.length,
                            stream.ohlcv.open.length,
                            stream.ohlcv.high.length,
                            stream.ohlcv.low.length,
                            stream.ohlcv.close.length,
                            stream.ohlcv.volume.length,
                            stream.ohlcv.hl2.length,
                            stream.ohlcv.hlc3.length,
                            stream.ohlcv.ohlc4.length,
                            stream.ohlcv.hlcc4.length,
                        ];
                        lengths.push(lens);
                    },
                });
                const runner = createScriptRunner({
                    compiled: { ...compiled, manifest: { ...compiled.manifest, maxLookback: 5 } },
                    capabilities: makeCapabilities(),
                });
                for (const bar of bars) await runner.onBarClose(bar);
                runner.dispose();
                return lengths.every((lens) => lens.every((l) => l === lens[0]));
            }),
            { numRuns: 25 },
        );
    });
});
