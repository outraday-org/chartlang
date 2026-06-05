// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { ulcerIndex } from "./ulcerIndex";

describe("ta.ulcerIndex", () => {
    it("emits NaN until the rolling-max term is warm", () => {
        // ulcerIndex composes `ta.highest` which requires `length`
        // closed bars before the first finite output; up to bar
        // `length - 1` the output is NaN.
        const bars = syntheticBars(10, 5);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => ulcerIndex("slot", bar.close, 4).current,
        );
        for (let i = 0; i < 3; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[3])).toBe(true);
    });

    it("output is always non-negative", () => {
        const bars = syntheticBars(50, 11);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => ulcerIndex("slot", bar.close, 5).current,
        );
        for (const v of out) {
            if (Number.isFinite(v)) expect(v).toBeGreaterThanOrEqual(0);
        }
    });

    it("outputs zero for a strictly increasing source (no drawdown)", () => {
        const closes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
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
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => ulcerIndex("slot", bar.close, 5).current,
        );
        // Past warmup, drawdown is 0 (every bar is the high) so ulcer = 0.
        for (let i = 4; i < bars.length; i += 1) {
            expect(out[i]).toBe(0);
        }
    });

    it("emits a positive value when the source falls below the rolling high", () => {
        const closes = [10, 20, 30, 40, 50, 30];
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
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => ulcerIndex("slot", bar.close, 5).current,
        );
        // At bar 4: highest(5) emits its first finite value (50);
        // dd = 100*(50-50)/50 = 0; ddSq=0 appended → window.length=1.
        // At bar 5: highest(5) over [20,30,40,50,30] = 50;
        // dd = 100*(30-50)/50 = -40; ddSq=1600 appended → window.length=2.
        // Partial-window denominator: ulcer = sqrt((0+1600)/2) = sqrt(800).
        expect(out[5]).toBeCloseTo(Math.sqrt(800), 8);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = ulcerIndex("slot", bar.close, 3);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => ulcerIndex("oops", 1, 3)).toThrowError(
            /ta.ulcerIndex called outside an active script step/,
        );
    });

    it("NaN source → NaN output (does not advance the window)", () => {
        const closes = [10, 20, 30, 40, 50, Number.NaN, 60];
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
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => ulcerIndex("slot", bar.close, 5).current,
        );
        expect(Number.isNaN(out[5])).toBe(true);
        // The next bar (close=60) folds in normally; rolling high(5) is
        // computed via ta.highest which skips NaN sources too.
        expect(Number.isFinite(out[6])).toBe(true);
    });
});

describe("ta.ulcerIndex tick-mode", () => {
    it("replaces the head without advancing the window", () => {
        const bars = syntheticBars(15, 6);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            ulcerIndex("slot", bar.close, 5),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickClose = bars[bars.length - 1].close - 100; // forces a drawdown
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], close: tickClose },
            () => ulcerIndex("slot", tickClose, 5).current,
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
        expect(Number.isFinite(head)).toBe(true);
        expect(head).toBeGreaterThanOrEqual(0);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(20, 7);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            ulcerIndex("slot", bar.close, 5),
        );
        const tickClose = bars[bars.length - 1].close - 5;
        const tickBar = { ...bars[bars.length - 1], close: tickClose };
        const a = tick(ctxRef, tickBar, () => ulcerIndex("slot", tickClose, 5).current);
        const b = tick(ctxRef, tickBar, () => ulcerIndex("slot", tickClose, 5).current);
        expect(b).toBe(a);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            ulcerIndex("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[2], () => ulcerIndex("slot", bars[2].close, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with NaN source returns NaN", () => {
        const bars = syntheticBars(15, 9);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            ulcerIndex("slot", bar.close, 5),
        );
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => ulcerIndex("slot", Number.NaN, 5).current,
        );
        expect(Number.isNaN(head)).toBe(true);
    });
});
