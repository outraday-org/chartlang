// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { highestbars } from "./highestbars.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";

// Build a constant-spacing OHLCV bar array from a plain high sequence.
function barsFromHighs(highs: ReadonlyArray<number>) {
    return highs.map((h, i) => ({
        time: 1_700_000_000_000 + i * 60_000,
        open: 0,
        high: h,
        low: 0,
        close: 0,
        volume: 0,
        symbol: "T",
        interval: "1m",
    }));
}

describe("ta.highestbars", () => {
    it("emits NaN until the window is filled", () => {
        const bars = syntheticBars(20, 5);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => highestbars("slot", bar.high, 4).current,
        );
        for (let i = 0; i < 3; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[3])).toBe(true);
    });

    it("returns 0 when the current bar is the highest", () => {
        const bars = barsFromHighs([1, 2, 3, 4, 5]);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => highestbars("slot", bar.high, 3).current,
        );
        // Strictly ascending: the current bar is always the max → offset 0.
        for (let i = 2; i < bars.length; i += 1) expect(out[i]).toBe(0);
    });

    it("returns the negative bar offset when the highest is in the past", () => {
        const bars = barsFromHighs([5, 4, 3, 2, 1]);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => highestbars("slot", bar.high, 3).current,
        );
        // Strictly descending: the oldest bar in each window is the max.
        expect(out[2]).toBe(-2); // window [5,4,3], max at offset -2
        expect(out[3]).toBe(-2); // window [4,3,2], max at offset -2
        expect(out[4]).toBe(-2); // window [3,2,1], max at offset -2
    });

    it("ties resolve to the most recent bar (smallest |offset|)", () => {
        const bars = barsFromHighs([5, 5, 5, 5]);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => highestbars("slot", bar.high, 3).current,
        );
        // All equal → most recent wins → offset 0.
        expect(out[2]).toBe(0);
        expect(out[3]).toBe(0);
    });

    it("matches a brute-force argmax over the trailing window", () => {
        const bars = syntheticBars(30, 11);
        const length = 5;
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => highestbars("slot", bar.high, length).current,
        );
        for (let i = length - 1; i < bars.length; i += 1) {
            let bestValue = Number.NEGATIVE_INFINITY;
            let bestOffset = Number.NaN;
            for (let k = 0; k < length; k += 1) {
                const v = bars[i - k].high;
                if (Number.isFinite(v) && v > bestValue) {
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
            const s = highestbars("slot", bar.high, 3);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => highestbars("oops", 1, 3)).toThrowError(
            /ta.highestbars called outside an active script step/,
        );
    });

    it("skips NaN inputs as candidates", () => {
        const bars = barsFromHighs([1, 2, Number.NaN, 1, 1]);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => highestbars("slot", bar.high, 3).current,
        );
        // Bar 3 window covers [2(NaN-skipped), NaN, 1] → finite candidates
        // are bar 1 (value 2, offset -2) and bar 3 (value 1, offset 0); max is 2.
        expect(out[3]).toBe(-2);
    });

    it("emits NaN when the whole window is NaN", () => {
        const bars = barsFromHighs([Number.NaN, Number.NaN, Number.NaN]);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => highestbars("slot", bar.high, 3).current,
        );
        expect(Number.isNaN(out[2])).toBe(true);
    });
});

describe("ta.highestbars tick-mode", () => {
    it("replaces the head without advancing the window", () => {
        const bars = barsFromHighs([1, 2, 3, 4, 5]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            highestbars("slot", bar.high, 5),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickHigh = 999;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], high: tickHigh },
            () => highestbars("slot", tickHigh, 5).current,
        );
        expect(ctxRef.ctx.stream.ohlcv.close.length).toBe(lengthBefore);
        // A tick high beyond all closed values makes the head the max → offset 0.
        expect(head).toBe(0);
    });

    it("tick that does not beat the closed max keeps the historical offset", () => {
        const bars = barsFromHighs([5, 1, 1, 1, 1]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            highestbars("slot", bar.high, 5),
        );
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], high: 0 },
            () => highestbars("slot", 0, 5).current,
        );
        // Window [5,1,1,1, tick=0]; max is 5 four bars back → offset -4.
        expect(head).toBe(-4);
    });

    it("two identical ticks produce the same head", () => {
        const bars = barsFromHighs([1, 2, 3, 4, 5]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            highestbars("slot", bar.high, 5),
        );
        const tickBar = { ...bars[bars.length - 1], high: 2 };
        const a = tick(ctxRef, tickBar, () => highestbars("slot", 2, 5).current);
        const b = tick(ctxRef, tickBar, () => highestbars("slot", 2, 5).current);
        expect(b).toBe(a);
    });

    it("tick during warmup returns NaN", () => {
        const bars = barsFromHighs([1, 2]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            highestbars("slot", bar.high, 5),
        );
        const head = tick(ctxRef, bars[1], () => highestbars("slot", bars[1].high, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with NaN source over an all-NaN closed window returns NaN", () => {
        const bars = barsFromHighs([Number.NaN, Number.NaN, Number.NaN]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            highestbars("slot", bar.high, 3),
        );
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => highestbars("slot", Number.NaN, 3).current,
        );
        expect(Number.isNaN(head)).toBe(true);
    });
});
