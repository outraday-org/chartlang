// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { williamsR } from "./williamsR";

describe("ta.williamsR", () => {
    it("emits NaN until the window is filled", () => {
        const bars = syntheticBars(20, 5);
        const out = harness(bars, bars.length + 1, () => williamsR("slot", 5).current);
        for (let i = 0; i < 4; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[4])).toBe(true);
    });

    it("output ∈ [-100, 0] after warmup", () => {
        const bars = syntheticBars(60, 7);
        const out = harness(bars, bars.length + 1, () => williamsR("slot", 14).current);
        for (let i = 13; i < bars.length; i += 1) {
            if (Number.isFinite(out[i])) {
                expect(out[i]).toBeGreaterThanOrEqual(-100);
                expect(out[i]).toBeLessThanOrEqual(0);
            }
        }
    });

    it("matches the canonical Williams %R formula", () => {
        // Hand-computed reference.
        const bars = Array.from({ length: 10 }, (_, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: 0,
            high: [10, 12, 14, 11, 13, 16, 15, 18, 17, 19][i],
            low: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14][i],
            close: [7, 9, 10, 9, 11, 13, 13, 16, 15, 18][i],
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, () => williamsR("slot", 3).current);
        // At bar 9 (window = bars[7..9]): hh = max(18,17,19)=19, ll = min(12,13,14)=12, close = 18
        // wr = -100 * (19 - 18) / (19 - 12) = -100 * 1/7 ≈ -14.2857
        expect(out[9]).toBeCloseTo((-100 * (19 - 18)) / (19 - 12), 10);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            const s = williamsR("slot", 3);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => williamsR("oops", 5)).toThrowError(
            /ta.williamsR called outside an active script step/,
        );
    });

    it("flat-line window (hh === ll) emits NaN", () => {
        const bars = Array.from({ length: 10 }, (_, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: 100,
            high: 100,
            low: 100,
            close: 100,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, () => williamsR("slot", 5).current);
        for (let i = 4; i < bars.length; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
    });

    it("accepts opts (offset, lineStyle) without throwing", () => {
        const bars = syntheticBars(20, 6);
        const out = harness(
            bars,
            bars.length + 1,
            () => williamsR("slot", 5, { offset: 0, lineStyle: "line" }).current,
        );
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });
});

describe("ta.williamsR tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(20, 7);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => williamsR("slot", 5));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar = { ...bars[bars.length - 1], close: bars[bars.length - 1].close + 5 };
        tick(ctxRef, tickBar, () => williamsR("slot", 5));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () => williamsR("slot", 5));
        const head = tick(ctxRef, bars[2], () => williamsR("slot", 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });
});
