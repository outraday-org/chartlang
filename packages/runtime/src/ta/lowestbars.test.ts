// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { lowestbars } from "./lowestbars.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";

// Build a constant-spacing OHLCV bar array from a plain low sequence.
function barsFromLows(lows: ReadonlyArray<number>) {
    return lows.map((l, i) => ({
        time: 1_700_000_000_000 + i * 60_000,
        open: 0,
        high: 0,
        low: l,
        close: 0,
        volume: 0,
        symbol: "T",
        interval: "1m",
    }));
}

describe("ta.lowestbars", () => {
    it("emits NaN until the window is filled", () => {
        const bars = syntheticBars(20, 5);
        const out = harness(bars, bars.length + 1, (bar) => lowestbars("slot", bar.low, 4).current);
        for (let i = 0; i < 3; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[3])).toBe(true);
    });

    it("returns 0 when the current bar is the lowest", () => {
        const bars = barsFromLows([5, 4, 3, 2, 1]);
        const out = harness(bars, bars.length + 1, (bar) => lowestbars("slot", bar.low, 3).current);
        // Strictly descending: the current bar is always the min → offset 0.
        for (let i = 2; i < bars.length; i += 1) expect(out[i]).toBe(0);
    });

    it("returns the negative bar offset when the lowest is in the past", () => {
        const bars = barsFromLows([1, 2, 3, 4, 5]);
        const out = harness(bars, bars.length + 1, (bar) => lowestbars("slot", bar.low, 3).current);
        // Strictly ascending: the oldest bar in each window is the min.
        expect(out[2]).toBe(-2);
        expect(out[3]).toBe(-2);
        expect(out[4]).toBe(-2);
    });

    it("ties resolve to the most recent bar (smallest |offset|)", () => {
        const bars = barsFromLows([5, 5, 5, 5]);
        const out = harness(bars, bars.length + 1, (bar) => lowestbars("slot", bar.low, 3).current);
        expect(out[2]).toBe(0);
        expect(out[3]).toBe(0);
    });

    it("matches a brute-force argmin over the trailing window", () => {
        const bars = syntheticBars(30, 11);
        const length = 5;
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => lowestbars("slot", bar.low, length).current,
        );
        for (let i = length - 1; i < bars.length; i += 1) {
            let bestValue = Number.POSITIVE_INFINITY;
            let bestOffset = Number.NaN;
            for (let k = 0; k < length; k += 1) {
                const v = bars[i - k].low;
                if (Number.isFinite(v) && v < bestValue) {
                    bestValue = v;
                    bestOffset = k === 0 ? 0 : -k;
                }
            }
            expect(out[i]).toBe(bestOffset);
        }
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = lowestbars("slot", bar.low, 3);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => lowestbars("oops", 1, 3)).toThrowError(
            /ta.lowestbars called outside an active script step/,
        );
    });

    it("skips NaN inputs as candidates", () => {
        const bars = barsFromLows([5, 4, Number.NaN, 5, 5]);
        const out = harness(bars, bars.length + 1, (bar) => lowestbars("slot", bar.low, 3).current);
        // Bar 3 window covers [4, NaN, 5]; finite candidates are bar 1
        // (value 4, offset -2) and bar 3 (value 5, offset 0); min is 4.
        expect(out[3]).toBe(-2);
    });

    it("emits NaN when the whole window is NaN", () => {
        const bars = barsFromLows([Number.NaN, Number.NaN, Number.NaN]);
        const out = harness(bars, bars.length + 1, (bar) => lowestbars("slot", bar.low, 3).current);
        expect(Number.isNaN(out[2])).toBe(true);
    });
});

describe("ta.lowestbars tick-mode", () => {
    it("replaces the head without advancing the window", () => {
        const bars = barsFromLows([5, 4, 3, 2, 1]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            lowestbars("slot", bar.low, 5),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickLow = -999;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], low: tickLow },
            () => lowestbars("slot", tickLow, 5).current,
        );
        expect(ctxRef.ctx.stream.ohlcv.close.length).toBe(lengthBefore);
        expect(head).toBe(0);
    });

    it("tick that does not beat the closed min keeps the historical offset", () => {
        const bars = barsFromLows([0, 5, 5, 5, 5]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            lowestbars("slot", bar.low, 5),
        );
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], low: 9 },
            () => lowestbars("slot", 9, 5).current,
        );
        // Window [0,5,5,5, tick=9]; min is 0 four bars back → offset -4.
        expect(head).toBe(-4);
    });

    it("two identical ticks produce the same head", () => {
        const bars = barsFromLows([5, 4, 3, 2, 1]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            lowestbars("slot", bar.low, 5),
        );
        const tickBar = { ...bars[bars.length - 1], low: 4 };
        const a = tick(ctxRef, tickBar, () => lowestbars("slot", 4, 5).current);
        const b = tick(ctxRef, tickBar, () => lowestbars("slot", 4, 5).current);
        expect(b).toBe(a);
    });

    it("tick during warmup returns NaN", () => {
        const bars = barsFromLows([1, 2]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            lowestbars("slot", bar.low, 5),
        );
        const head = tick(ctxRef, bars[1], () => lowestbars("slot", bars[1].low, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with NaN source over an all-NaN closed window returns NaN", () => {
        const bars = barsFromLows([Number.NaN, Number.NaN, Number.NaN]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            lowestbars("slot", bar.low, 3),
        );
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => lowestbars("slot", Number.NaN, 3).current,
        );
        expect(Number.isNaN(head)).toBe(true);
    });
});
