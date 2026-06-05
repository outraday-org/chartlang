// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { ema } from "./ema";
import { computeEmaOfFloat64 } from "./lib/emaFloat64";

describe("ta.ema", () => {
    it("matches computeEmaOfFloat64 over a 50-bar synthetic walk", () => {
        const bars = syntheticBars(50, 7);
        const closes = new Float64Array(bars.map((b) => b.close));
        const expected = computeEmaOfFloat64(closes, 10);
        const actual = harness(bars, bars.length + 1, (bar) => ema("slot", bar.close, 10).current);
        for (let i = 0; i < bars.length; i += 1) {
            const a = actual[i];
            const e = expected[i];
            if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
            else expect(a).toBeCloseTo(e, 10);
        }
    });

    it("emits NaN for the first length−1 bars", () => {
        const bars = syntheticBars(30, 3);
        const out = harness(bars, bars.length + 1, (bar) => ema("slot", bar.close, 5).current);
        for (let i = 0; i < 4; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[4])).toBe(true);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = ema("slot", bar.close, 3);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => ema("oops", 1, 3)).toThrowError(/ta.ema called outside an active script step/);
    });

    it("accepts a Series source via .current", () => {
        const bars = syntheticBars(20, 4);
        // Pass the runtime's close-series view instead of the scalar.
        const out = harness(
            bars,
            bars.length + 1,
            (_bar, ctx) => ema("slot", ctx.stream.seriesViews.close, 5).current,
        );
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });

    it("holds the previous EMA forward when the source is NaN past warmup", () => {
        const bars: Bar[] = syntheticBars(20, 4).map((b, i) =>
            i === 10 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => ema("slot", bar.close, 5).current);
        expect(out[10]).toBeCloseTo(out[9], 12);
    });

    it("holds prevClosedEma during NaN warmup", () => {
        // Slot starts un-warm; a NaN tick during seeding shouldn't crash.
        const bars: Bar[] = syntheticBars(10, 8);
        bars[1] = { ...bars[1], close: Number.NaN };
        const out = harness(bars, bars.length + 1, (bar) => ema("slot", bar.close, 5).current);
        expect(Number.isNaN(out[0])).toBe(true);
        expect(Number.isNaN(out[1])).toBe(true);
    });
});

describe("ta.ema tick during seeding", () => {
    it("tick while count < length-1 returns NaN", () => {
        const bars = syntheticBars(3, 5);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 10, (bar) =>
            ema("slot", bar.close, 5),
        );
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => ema("slot", bars[bars.length - 1].close, 5).current,
        );
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick at the seed boundary returns the provisional seed mean", () => {
        // 4 closes, length 5: count = 4 < 5; tick with one more value
        // simulates the seed completing (count would be 5) and returns the
        // mean.
        const bars = syntheticBars(4, 6);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 10, (bar) =>
            ema("slot", bar.close, 5),
        );
        const tickClose = 200;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], close: tickClose },
            () => ema("slot", tickClose, 5).current,
        );
        const expected = (bars.reduce((a, b) => a + b.close, 0) + tickClose) / 5;
        expect(head).toBeCloseTo(expected, 10);
    });

    it("tick with NaN src during seeding returns prevEma (NaN)", () => {
        const bars = syntheticBars(2, 7);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            ema("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[bars.length - 1], () => ema("slot", Number.NaN, 5).current);
        // prevEma is NaN during seeding, so the tick yields NaN.
        expect(Number.isNaN(head)).toBe(true);
    });
});

describe("ta.ema tick-mode", () => {
    it("replaces the head value without advancing length", () => {
        const bars = syntheticBars(10, 2);
        const length = 3;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            ema("slot", bar.close, length),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const headBefore = (
            ctxRef.ctx.stream.taSlots.get("slot") as {
                series: { current: number };
            }
        ).series.current;
        const tickBar: Bar = { ...bars[bars.length - 1], close: bars[bars.length - 1].close + 5 };
        tick(ctxRef, tickBar, () => ema("slot", tickBar.close, length));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        const headAfter = (
            ctxRef.ctx.stream.taSlots.get("slot") as {
                series: { current: number };
            }
        ).series.current;
        expect(lengthAfter).toBe(lengthBefore);
        expect(headAfter).not.toBe(headBefore);
    });

    it("two identical ticks compute the same head (don't compound)", () => {
        const bars = syntheticBars(20, 9);
        const length = 5;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            ema("slot", bar.close, length),
        );
        const tickClose = bars[bars.length - 1].close + 10;
        const tickBar: Bar = { ...bars[bars.length - 1], close: tickClose };
        let a = 0;
        let b = 0;
        tick(ctxRef, tickBar, () => {
            a = ema("slot", tickBar.close, length).current;
            return a;
        });
        tick(ctxRef, tickBar, () => {
            b = ema("slot", tickBar.close, length).current;
            return b;
        });
        expect(b).toBeCloseTo(a, 12);
    });
});

describe("ta.ema — opts.offset", () => {
    it("offset === 0 returns the same Series identity as no opts", () => {
        const bars = syntheticBars(20, 7);
        const identities = new Set<unknown>();
        let toggle = false;
        harness(bars, bars.length + 1, (bar) => {
            toggle = !toggle;
            identities.add(
                toggle ? ema("slot", bar.close, 5) : ema("slot", bar.close, 5, { offset: 0 }),
            );
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("offset === k > 0 shifts the series so .current returns the value k bars ago", () => {
        const bars = syntheticBars(30, 11);
        const unshifted = harness(
            bars,
            bars.length + 1,
            (bar) => ema("slot", bar.close, 5).current,
        );
        const shifted = harness(
            bars,
            bars.length + 1,
            (bar) => ema("slot", bar.close, 5, { offset: 3 }).current,
        );
        for (let i = 3; i < bars.length; i += 1) {
            const u = unshifted[i - 3];
            const s = shifted[i];
            if (Number.isNaN(u)) expect(Number.isNaN(s)).toBe(true);
            else expect(s).toBeCloseTo(u, 12);
        }
    });

    it("offset === -k returns NaN at the head (future read)", () => {
        const bars = syntheticBars(20, 1);
        const head = harness(
            bars,
            bars.length + 1,
            (bar) => ema("slot", bar.close, 5, { offset: -2 }).current,
        );
        expect(Number.isNaN(head[head.length - 1])).toBe(true);
    });

    it("two calls with the same non-zero offset return the same Series identity", () => {
        const bars = syntheticBars(10, 3);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(ema("slot", bar.close, 5, { offset: 2 }));
            return null;
        });
        expect(identities.size).toBe(1);
    });
});
