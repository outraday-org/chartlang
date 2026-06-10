// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { bb } from "./bb.js";
import { bbw } from "./bbw.js";

describe("ta.bbw", () => {
    it("emits NaN until warmup completes (length - 1 closed bars)", () => {
        const bars = syntheticBars(10, 4);
        const out = harness(bars, bars.length + 1, (bar) => bbw("slot", bar.close, 5).current);
        for (let i = 0; i < 4; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[4])).toBe(true);
    });

    it("matches `(upper - lower) / middle` against the composed bb", () => {
        const bars = syntheticBars(40, 19);
        const out = harness(bars, bars.length + 1, (bar) => {
            const bands = bb("slot/bb", bar.close, 10, { multiplier: 2 });
            const w = bbw("slot", bar.close, 10, { multiplier: 2 }).current;
            return {
                w,
                expected: (bands.upper.current - bands.lower.current) / bands.middle.current,
            };
        });
        for (let i = 9; i < bars.length; i += 1) {
            if (!Number.isFinite(out[i].expected)) {
                expect(Number.isNaN(out[i].w)).toBe(true);
            } else {
                expect(out[i].w).toBeCloseTo(out[i].expected, 12);
            }
        }
    });

    it("returns NaN when the middle is zero", () => {
        const bars = syntheticBars(10, 1).map((b) => ({ ...b, close: 0 }));
        const out = harness(bars, bars.length + 1, (bar) => bbw("slot", bar.close, 5).current);
        for (let i = 4; i < bars.length; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
    });

    it("emits 0 when the band collapses on a flat non-zero source", () => {
        // Constant close = 100 → upper = lower = 100 → bbw = 0.
        const bars = syntheticBars(10, 2).map((b) => ({ ...b, close: 100 }));
        const out = harness(bars, bars.length + 1, (bar) => bbw("slot", bar.close, 5).current);
        for (let i = 4; i < bars.length; i += 1) expect(out[i]).toBe(0);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 6);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            ids.add(bbw("slot", bar.close, 5));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("defaults multiplier to 2", () => {
        const bars = syntheticBars(20, 8);
        const a = harness(bars, bars.length + 1, (bar) => bbw("a", bar.close, 5).current);
        const b = harness(
            bars,
            bars.length + 1,
            (bar) => bbw("b", bar.close, 5, { multiplier: 2 }).current,
        );
        for (let i = 0; i < bars.length; i += 1) {
            if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
            else expect(a[i]).toBeCloseTo(b[i], 12);
        }
    });

    it("throws when called outside an active script step", () => {
        expect(() => bbw("oops", 1, 5)).toThrowError(/ta.bbw called outside an active script step/);
    });

    it("NaN source → NaN output", () => {
        const bars = syntheticBars(15, 5);
        const out = harness(bars, bars.length + 1, () => bbw("slot", Number.NaN, 5).current);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });
});

describe("ta.bbw tick-mode", () => {
    it("replaces the head without advancing output length", () => {
        const bars = syntheticBars(15, 12);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            bbw("slot", bar.close, 5),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, close: last.close + 10 }, () => bbw("slot", last.close + 10, 5));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("identical ticks produce the same head", () => {
        const bars = syntheticBars(15, 14);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            bbw("slot", bar.close, 5),
        );
        const last = bars[bars.length - 1];
        const tickClose = last.close + 7;
        const a = tick(
            ctxRef,
            { ...last, close: tickClose },
            () => bbw("slot", tickClose, 5).current,
        );
        const b = tick(
            ctxRef,
            { ...last, close: tickClose },
            () => bbw("slot", tickClose, 5).current,
        );
        expect(b).toBe(a);
    });
});
