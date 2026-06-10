// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { median } from "./median.js";

describe("ta.median", () => {
    it("emits NaN until the window is filled", () => {
        const bars = syntheticBars(20, 5);
        const out = harness(bars, bars.length + 1, (bar) => median("slot", bar.close, 5).current);
        for (let i = 0; i < 4; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[4])).toBe(true);
    });

    it("returns the rolling median for odd length (middle value)", () => {
        // [10, 30, 20, 50, 40] sorted = [10, 20, 30, 40, 50] → median 30
        const closes = [10, 30, 20, 50, 40, 5, 35];
        const bars = closes.map((c, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: c,
            high: c,
            low: c,
            close: c,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => median("slot", bar.close, 5).current);
        expect(out[4]).toBe(30);
        // Window at i=5: [30, 20, 50, 40, 5] sorted = [5, 20, 30, 40, 50] → 30
        expect(out[5]).toBe(30);
        // Window at i=6: [20, 50, 40, 5, 35] sorted = [5, 20, 35, 40, 50] → 35
        expect(out[6]).toBe(35);
    });

    it("returns the average of two middle values for even length", () => {
        // [10, 30, 20, 50] sorted = [10, 20, 30, 50] → median (20 + 30) / 2 = 25
        const closes = [10, 30, 20, 50, 40, 5];
        const bars = closes.map((c, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: c,
            high: c,
            low: c,
            close: c,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => median("slot", bar.close, 4).current);
        expect(out[3]).toBe(25);
        // Window at i=4: [30, 20, 50, 40] sorted = [20, 30, 40, 50] → 35
        expect(out[4]).toBe(35);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = median("slot", bar.close, 3);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => median("oops", 1, 3)).toThrowError(
            /ta.median called outside an active script step/,
        );
    });

    it("skips NaN inputs from the sort — median of finite values only", () => {
        const closes = [10, 30, Number.NaN, 50, 40];
        const bars = closes.map((c, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: 0,
            high: 0,
            low: 0,
            close: c,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => median("slot", bar.close, 5).current);
        // Finite slots = [10, 30, 50, 40] → sorted [10, 30, 40, 50] → (30+40)/2 = 35
        expect(out[4]).toBe(35);
    });

    it("returns NaN when every slot in the window is NaN", () => {
        const bars = [Number.NaN, Number.NaN, Number.NaN].map((c, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: 0,
            high: 0,
            low: 0,
            close: c,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => median("slot", bar.close, 3).current);
        expect(Number.isNaN(out[2])).toBe(true);
    });

    it("length=1 mirrors the source", () => {
        const closes = [10, 30, 20, 50, 40];
        const bars = closes.map((c, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: c,
            high: c,
            low: c,
            close: c,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => median("slot", bar.close, 1).current);
        for (let i = 0; i < closes.length; i += 1) {
            expect(out[i]).toBe(closes[i]);
        }
    });
});

describe("ta.median tick-mode", () => {
    it("replaces the head without advancing the window", () => {
        const bars = syntheticBars(15, 6);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            median("slot", bar.close, 5),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        // Replace head close with a known value and verify the median
        // shifts to substitute the head with `tickClose`.
        const tickClose = bars[bars.length - 1].close + 100;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], close: tickClose },
            () => median("slot", tickClose, 5).current,
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
        expect(Number.isFinite(head)).toBe(true);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(20, 7);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            median("slot", bar.close, 5),
        );
        const tickClose = bars[bars.length - 1].close + 5;
        const tickBar = { ...bars[bars.length - 1], close: tickClose };
        const a = tick(ctxRef, tickBar, () => median("slot", tickClose, 5).current);
        const b = tick(ctxRef, tickBar, () => median("slot", tickClose, 5).current);
        expect(b).toBe(a);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            median("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[2], () => median("slot", bars[2].close, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with NaN source ignores the head — median of the other slots", () => {
        const closes = [10, 30, 20, 50, 40];
        const bars = closes.map((c, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: c,
            high: c,
            low: c,
            close: c,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            median("slot", bar.close, 5),
        );
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => median("slot", Number.NaN, 5).current,
        );
        // Close-side window contains [10, 30, 20, 50, 40]; the head is
        // the most recent close (40). NaN tick → skip head → finite
        // remaining = [50, 20, 30, 10]. Sorted [10, 20, 30, 50] →
        // median (20 + 30) / 2 = 25.
        expect(head).toBe(25);
    });
});
