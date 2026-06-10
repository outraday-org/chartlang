// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { chop } from "./chop.js";

function bar(h: number, l: number, c: number, i: number): Bar {
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open: c,
        high: h,
        low: l,
        close: c,
        volume: 0,
        symbol: "T",
        interval: "1m",
    };
}

describe("ta.chop", () => {
    it("emits NaN until the trailing window is fully warmed (length bars)", () => {
        const bars = syntheticBars(20, 41);
        const out = harness(bars, bars.length + 1, () => chop("slot", 5).current);
        for (let i = 0; i < 4; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        // First defined index = length - 1 (= 4 for length=5)
        expect(Number.isFinite(out[4])).toBe(true);
    });

    it("output is in [0, 100] across defined slots", () => {
        const bars = syntheticBars(50, 43);
        const out = harness(bars, bars.length + 1, () => chop("slot", 14).current);
        for (const v of out) {
            if (Number.isFinite(v)) {
                expect(v).toBeGreaterThanOrEqual(0);
                expect(v).toBeLessThanOrEqual(100);
            }
        }
    });

    it("returns NaN when range collapses to zero (flat bars)", () => {
        // All bars identical → highest === lowest, range = 0 → NaN.
        const bars = Array.from({ length: 10 }, (_, i) => bar(5, 5, 5, i));
        const out = harness(bars, bars.length + 1, () => chop("slot", 5).current);
        for (let i = 4; i < out.length; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
    });

    it("strong trend → low chop (well below 50)", () => {
        // Monotonic uptrend: each bar's high/low/close strictly above
        // the previous. Range grows with N, sumTr is small.
        const bars = Array.from({ length: 30 }, (_, i) => bar(i + 1.1, i + 0.9, i + 1, i));
        const out = harness(bars, bars.length + 1, () => chop("slot", 10).current);
        const last = out[out.length - 1];
        expect(Number.isFinite(last)).toBe(true);
        expect(last).toBeLessThan(40);
    });

    it("throws when called outside an active script step", () => {
        expect(() => chop("oops", 14)).toThrowError(/ta.chop called outside an active script step/);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 47);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            ids.add(chop("slot", 5));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("skips bars with NaN high/low/close (emits NaN, no TR update)", () => {
        const goodBar = bar(2, 1, 1.5, 0);
        const bars = [
            goodBar,
            goodBar,
            goodBar,
            goodBar,
            bar(Number.NaN, Number.NaN, Number.NaN, 4),
        ];
        const out = harness(bars, bars.length + 1, () => chop("slot", 5).current);
        // The NaN bar emits NaN.
        expect(Number.isNaN(out[4])).toBe(true);
    });
});

describe("ta.chop tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(20, 51);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => chop("slot", 5));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, high: last.high + 10, low: last.low - 10 }, () => chop("slot", 5));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(20, 53);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => chop("slot", 5));
        const last = bars[bars.length - 1];
        const tickBar = { ...last, high: last.high + 5, low: last.low - 5 };
        const a = tick(ctxRef, tickBar, () => chop("slot", 5).current);
        const b = tick(ctxRef, tickBar, () => chop("slot", 5).current);
        expect(b).toBe(a);
    });

    it("tick after close uses the bar-before-current's close for TR (parity with atr.ts)", () => {
        // After 10 close-side bars at length=5 the slot is fully warmed.
        // A tick changing high/low produces a defined head (in [0, 100]).
        const bars = Array.from({ length: 10 }, (_, i) => bar(10 + i, 5 + i, 7 + i, i));
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => chop("slot", 5));
        const last = bars[bars.length - 1];
        const head = tick(
            ctxRef,
            { ...last, high: last.high + 100, low: last.low - 100 },
            () => chop("slot", 5).current,
        );
        // The output is well-defined (finite, in [0, 100]) after warmup.
        expect(Number.isFinite(head)).toBe(true);
        expect(head).toBeGreaterThanOrEqual(0);
        expect(head).toBeLessThanOrEqual(100);
    });
});
