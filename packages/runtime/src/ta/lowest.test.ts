// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { lowest } from "./lowest";

describe("ta.lowest", () => {
    it("emits NaN until the window is filled", () => {
        const bars = syntheticBars(20, 5);
        const out = harness(bars, bars.length + 1, (bar) => lowest("slot", bar.low, 4).current);
        for (let i = 0; i < 3; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[3])).toBe(true);
    });

    it("returns the rolling min over the last `length` lows", () => {
        const bars = syntheticBars(30, 11);
        const out = harness(bars, bars.length + 1, (bar) => lowest("slot", bar.low, 5).current);
        for (let i = 4; i < bars.length; i += 1) {
            let expected = Number.POSITIVE_INFINITY;
            for (let j = i - 4; j <= i; j += 1) {
                if (Number.isFinite(bars[j].low)) expected = Math.min(expected, bars[j].low);
            }
            expect(out[i]).toBeCloseTo(expected, 12);
        }
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = lowest("slot", bar.low, 3);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => lowest("oops", 1, 3)).toThrowError(
            /ta.lowest called outside an active script step/,
        );
    });

    it("skips NaN inputs from the window", () => {
        const bars = syntheticBars(10, 4).map((b, i) => (i === 5 ? { ...b, low: Number.NaN } : b));
        const out = harness(bars, bars.length + 1, (bar) => lowest("slot", bar.low, 4).current);
        const window = [bars[3].low, bars[4].low, bars[6].low];
        const expected = Math.min(...window);
        expect(out[6]).toBeCloseTo(expected, 12);
    });

    it("evicts entries that fall out of the trailing window", () => {
        const bars = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((l, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: l,
            high: l,
            low: l,
            close: l,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => lowest("slot", bar.low, 3).current);
        expect(out[2]).toBe(1);
        expect(out[3]).toBe(2);
        expect(out[5]).toBe(4);
    });
});

describe("ta.lowest tick-mode", () => {
    it("replaces the head with a tick below the window-excluding-head", () => {
        const bars = syntheticBars(15, 6);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            lowest("slot", bar.low, 5),
        );
        const tickLow = -100;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], low: tickLow },
            () => lowest("slot", tickLow, 5).current,
        );
        expect(head).toBe(tickLow);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(20, 7);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            lowest("slot", bar.low, 5),
        );
        const tickLow = bars[bars.length - 1].low - 5;
        const tickBar = { ...bars[bars.length - 1], low: tickLow };
        const a = tick(ctxRef, tickBar, () => lowest("slot", tickLow, 5).current);
        const b = tick(ctxRef, tickBar, () => lowest("slot", tickLow, 5).current);
        expect(b).toBe(a);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            lowest("slot", bar.low, 5),
        );
        const head = tick(ctxRef, bars[2], () => lowest("slot", bars[2].low, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with NaN source over an all-NaN closed window returns NaN", () => {
        const bars = [Number.NaN, Number.NaN, Number.NaN].map((l, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: 0,
            high: 0,
            low: l,
            close: 0,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            lowest("slot", bar.low, 3),
        );
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => lowest("slot", Number.NaN, 3).current,
        );
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with finite src and length=1 returns the tick value", () => {
        const bars = [10, 20].map((l, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: l,
            high: l,
            low: l,
            close: l,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            lowest("slot", bar.low, 1),
        );
        const head = tick(ctxRef, bars[bars.length - 1], () => lowest("slot", -50, 1).current);
        expect(head).toBe(-50);
    });

    it("tick with NaN source falls back to the window-excluding-head min", () => {
        // Constant-low stream guarantees the deque retains every bar.
        const bars = [10, 10, 10, 10, 10, 10].map((l, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: l,
            high: l,
            low: l,
            close: l,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            lowest("slot", bar.low, 5),
        );
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => lowest("slot", Number.NaN, 5).current,
        );
        expect(head).toBe(10);
    });
});
