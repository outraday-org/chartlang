// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { bb } from "./bb.js";
import { bbPercentB } from "./bbPercentB.js";

describe("ta.bbPercentB", () => {
    it("emits NaN until warmup completes (length - 1 closed bars)", () => {
        const bars = syntheticBars(10, 3);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => bbPercentB("slot", bar.close, 5).current,
        );
        for (let i = 0; i < 4; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[4])).toBe(true);
    });

    it("matches `(src - lower) / (upper - lower)` against the composed bb", () => {
        const bars = syntheticBars(40, 13);
        const out = harness(bars, bars.length + 1, (bar) => {
            const bands = bb("slot/bb", bar.close, 10, { multiplier: 2 });
            const pct = bbPercentB("slot", bar.close, 10, { multiplier: 2 }).current;
            return {
                pct,
                expected:
                    (bar.close - bands.lower.current) / (bands.upper.current - bands.lower.current),
            };
        });
        for (let i = 9; i < bars.length; i += 1) {
            if (!Number.isFinite(out[i].expected)) {
                expect(Number.isNaN(out[i].pct)).toBe(true);
            } else {
                expect(out[i].pct).toBeCloseTo(out[i].expected, 12);
            }
        }
    });

    it("returns NaN when the band collapses (flat source → zero band width)", () => {
        // Constant closes → σ = 0 → upper = lower = middle → denom = 0 → NaN.
        const bars = syntheticBars(10, 1).map((b) => ({ ...b, close: 100 }));
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => bbPercentB("slot", bar.close, 5).current,
        );
        for (let i = 4; i < bars.length; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 2);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            ids.add(bbPercentB("slot", bar.close, 5));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("defaults multiplier to 2", () => {
        const bars = syntheticBars(20, 7);
        const a = harness(bars, bars.length + 1, (bar) => bbPercentB("a", bar.close, 5).current);
        const b = harness(
            bars,
            bars.length + 1,
            (bar) => bbPercentB("b", bar.close, 5, { multiplier: 2 }).current,
        );
        for (let i = 0; i < bars.length; i += 1) {
            if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
            else expect(a[i]).toBeCloseTo(b[i], 12);
        }
    });

    it("throws when called outside an active script step", () => {
        expect(() => bbPercentB("oops", 1, 5)).toThrowError(
            /ta.bbPercentB called outside an active script step/,
        );
    });

    it("NaN source → NaN output", () => {
        const bars = syntheticBars(15, 5);
        const out = harness(bars, bars.length + 1, () => bbPercentB("slot", Number.NaN, 5).current);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });
});

describe("ta.bbPercentB tick-mode", () => {
    it("replaces the head without advancing output length", () => {
        const bars = syntheticBars(15, 11);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            bbPercentB("slot", bar.close, 5),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, close: last.close + 10 }, () =>
            bbPercentB("slot", last.close + 10, 5),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("identical ticks produce the same head", () => {
        const bars = syntheticBars(15, 9);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            bbPercentB("slot", bar.close, 5),
        );
        const last = bars[bars.length - 1];
        const tickClose = last.close + 5;
        const a = tick(
            ctxRef,
            { ...last, close: tickClose },
            () => bbPercentB("slot", tickClose, 5).current,
        );
        const b = tick(
            ctxRef,
            { ...last, close: tickClose },
            () => bbPercentB("slot", tickClose, 5).current,
        );
        expect(b).toBe(a);
    });
});
