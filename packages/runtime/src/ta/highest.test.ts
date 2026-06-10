// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { highest } from "./highest.js";

describe("ta.highest", () => {
    it("emits NaN until the window is filled", () => {
        const bars = syntheticBars(20, 5);
        const out = harness(bars, bars.length + 1, (bar) => highest("slot", bar.high, 4).current);
        for (let i = 0; i < 3; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[3])).toBe(true);
    });

    it("returns the rolling max over the last `length` highs", () => {
        const bars = syntheticBars(30, 11);
        const out = harness(bars, bars.length + 1, (bar) => highest("slot", bar.high, 5).current);
        for (let i = 4; i < bars.length; i += 1) {
            let expected = Number.NEGATIVE_INFINITY;
            for (let j = i - 4; j <= i; j += 1) {
                if (Number.isFinite(bars[j].high)) expected = Math.max(expected, bars[j].high);
            }
            expect(out[i]).toBeCloseTo(expected, 12);
        }
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = highest("slot", bar.high, 3);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => highest("oops", 1, 3)).toThrowError(
            /ta.highest called outside an active script step/,
        );
    });

    it("skips NaN inputs from the window — still emits the max of the finite values", () => {
        const bars = syntheticBars(10, 4).map((b, i) => (i === 5 ? { ...b, high: Number.NaN } : b));
        const out = harness(bars, bars.length + 1, (bar) => highest("slot", bar.high, 4).current);
        // After bar 5 (NaN), bar 6's window covers bars 3..6; NaN skipped.
        const window = [bars[3].high, bars[4].high, bars[6].high];
        const expected = Math.max(...window);
        expect(out[6]).toBeCloseTo(expected, 12);
    });

    it("evicts entries that fall out of the trailing window", () => {
        const bars = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((h, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: h,
            high: h,
            low: h,
            close: h,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => highest("slot", bar.high, 3).current);
        // Window of 3 trailing values; max should descend.
        expect(out[2]).toBe(10);
        expect(out[3]).toBe(9);
        expect(out[5]).toBe(7);
    });
});

describe("ta.highest tick-mode", () => {
    it("replaces the head without advancing the window", () => {
        const bars = syntheticBars(15, 6);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            highest("slot", bar.high, 5),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickHigh = bars[bars.length - 1].high + 100;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], high: tickHigh },
            () => highest("slot", tickHigh, 5).current,
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
        // A tick high beyond all closed values should become the new max.
        expect(head).toBe(tickHigh);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(20, 7);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            highest("slot", bar.high, 5),
        );
        const tickHigh = bars[bars.length - 1].high + 5;
        const tickBar = { ...bars[bars.length - 1], high: tickHigh };
        const a = tick(ctxRef, tickBar, () => highest("slot", tickHigh, 5).current);
        const b = tick(ctxRef, tickBar, () => highest("slot", tickHigh, 5).current);
        expect(b).toBe(a);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            highest("slot", bar.high, 5),
        );
        const head = tick(ctxRef, bars[2], () => highest("slot", bars[2].high, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with NaN source falls back to the window-excluding-head max", () => {
        // Use a constant-high stream so the deque retains every bar — the
        // window-excluding-head max is guaranteed finite.
        const bars = [10, 10, 10, 10, 10, 10].map((h, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: h,
            high: h,
            low: h,
            close: h,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            highest("slot", bar.high, 5),
        );
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => highest("slot", Number.NaN, 5).current,
        );
        expect(head).toBe(10);
    });

    it("tick with NaN source on a strictly-ascending stream returns the second-highest closed value", () => {
        const bars = [1, 2, 3, 4, 5].map((h, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: h,
            high: h,
            low: h,
            close: h,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            highest("slot", bar.high, 5),
        );
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => highest("slot", Number.NaN, 5).current,
        );
        // Strictly ascending: max of {1, 2, 3, 4} (window excluding head) = 4.
        expect(head).toBe(4);
    });

    it("tick with finite src and length=1 returns the tick value (no other window slots)", () => {
        const bars = [10, 20].map((h, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: h,
            high: h,
            low: h,
            close: h,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            highest("slot", bar.high, 1),
        );
        const head = tick(ctxRef, bars[bars.length - 1], () => highest("slot", 999, 1).current);
        expect(head).toBe(999);
    });

    it("tick with NaN source over an all-NaN closed window returns NaN", () => {
        const bars = [Number.NaN, Number.NaN, Number.NaN].map((h, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: 0,
            high: h,
            low: 0,
            close: 0,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            highest("slot", bar.high, 3),
        );
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => highest("slot", Number.NaN, 3).current,
        );
        expect(Number.isNaN(head)).toBe(true);
    });
});
