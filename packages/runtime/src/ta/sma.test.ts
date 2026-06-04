// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { computeSmaOfFloat64 } from "./lib/smaFloat64";
import { sma } from "./sma";

describe("ta.sma", () => {
    it("matches computeSmaOfFloat64 over a 50-bar synthetic walk", () => {
        const bars = syntheticBars(50, 11);
        const closes = new Float64Array(bars.map((b) => b.close));
        const expected = computeSmaOfFloat64(closes, 10);
        const actual = harness(bars, bars.length + 1, (bar) => sma("slot", bar.close, 10).current);
        for (let i = 0; i < bars.length; i += 1) {
            const a = actual[i];
            const e = expected[i];
            if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
            else expect(a).toBeCloseTo(e, 12);
        }
    });

    it("emits NaN until the window is filled", () => {
        const bars = syntheticBars(20, 5);
        const out = harness(bars, bars.length + 1, (bar) => sma("slot", bar.close, 4).current);
        for (let i = 0; i < 3; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[3])).toBe(true);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = sma("slot", bar.close, 3);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => sma("oops", 1, 3)).toThrowError(/ta.sma called outside an active script step/);
    });

    it("accepts a Series source via .current", () => {
        const bars = syntheticBars(20, 7);
        const out = harness(
            bars,
            bars.length + 1,
            (_bar, ctx) => sma("slot", ctx.stream.seriesViews.close, 5).current,
        );
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });

    it("holds the previous mean forward when the source is NaN past warmup", () => {
        const bars = syntheticBars(20, 4).map((b, i) =>
            i === 12 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => sma("slot", bar.close, 5).current);
        expect(out[12]).toBeCloseTo(out[11], 12);
    });

    it("returns NaN for NaN during warmup", () => {
        const bars = syntheticBars(10, 3).map((b, i) =>
            i === 1 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => sma("slot", bar.close, 4).current);
        expect(Number.isNaN(out[1])).toBe(true);
    });
});

describe("ta.sma tick-mode", () => {
    it("replaces the head without advancing the window", () => {
        const bars = syntheticBars(10, 8);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            sma("slot", bar.close, 4),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const headBefore = (
            ctxRef.ctx.stream.taSlots.get("slot") as {
                series: { current: number };
            }
        ).series.current;
        const tickClose = bars[bars.length - 1].close + 5;
        tick(ctxRef, { ...bars[bars.length - 1], close: tickClose }, () =>
            sma("slot", tickClose, 4),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        const headAfter = (
            ctxRef.ctx.stream.taSlots.get("slot") as {
                series: { current: number };
            }
        ).series.current;
        expect(lengthAfter).toBe(lengthBefore);
        expect(headAfter).not.toBe(headBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(20, 9);
        const length = 5;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            sma("slot", bar.close, length),
        );
        const tickClose = bars[bars.length - 1].close + 10;
        const tickBar = { ...bars[bars.length - 1], close: tickClose };
        let a = 0;
        let b = 0;
        tick(ctxRef, tickBar, () => {
            a = sma("slot", tickClose, length).current;
            return a;
        });
        tick(ctxRef, tickBar, () => {
            b = sma("slot", tickClose, length).current;
            return b;
        });
        expect(b).toBeCloseTo(a, 12);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            sma("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[2], () => sma("slot", bars[2].close, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with NaN source returns NaN", () => {
        const bars = syntheticBars(20, 1);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            sma("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[bars.length - 1], () => sma("slot", Number.NaN, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });
});
