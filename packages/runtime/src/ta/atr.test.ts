// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { atr } from "./atr";
import { computeAtrSeries } from "./lib/trSeries";

describe("ta.atr", () => {
    it("matches computeAtrSeries over a 50-bar synthetic walk", () => {
        const bars = syntheticBars(50, 51);
        const expected = computeAtrSeries(bars, 14).atr;
        const actual = harness(bars, bars.length + 1, () => atr("slot", 14).current);
        for (let i = 0; i < bars.length; i += 1) {
            const a = actual[i];
            const e = expected[i];
            if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
            else expect(a).toBeCloseTo(e, 8);
        }
    });

    it("emits NaN until bar length-1", () => {
        const bars = syntheticBars(20, 1);
        const out = harness(bars, bars.length + 1, () => atr("slot", 5).current);
        for (let i = 0; i < 4; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[4])).toBe(true);
    });

    it("ATR is non-negative", () => {
        const bars = syntheticBars(60, 27);
        const out = harness(bars, bars.length + 1, () => atr("slot", 14).current);
        for (const v of out) {
            if (Number.isFinite(v)) expect(v).toBeGreaterThanOrEqual(0);
        }
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            ids.add(atr("slot", 3));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => atr("oops", 5)).toThrowError(/ta.atr called outside an active script step/);
    });

    it("holds the prior ATR on a NaN close", () => {
        const bars = syntheticBars(30, 1).map((b, i) =>
            i === 20 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, () => atr("slot", 5).current);
        // After warmup, NaN OHLC at i=20 should hold the prior ATR.
        expect(out[20]).toBeCloseTo(out[19], 12);
    });

    it("NaN OHLC during warmup yields NaN", () => {
        const bars = syntheticBars(3, 1).map((b, i) =>
            i === 0 ? { ...b, high: Number.NaN, low: Number.NaN, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, () => atr("slot", 5).current);
        expect(Number.isNaN(out[0])).toBe(true);
    });
});

describe("ta.atr tick-mode", () => {
    it("replaces the head without advancing length", () => {
        const bars = syntheticBars(30, 5);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => atr("slot", 5));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, high: last.high + 10, low: last.low - 10 }, () => atr("slot", 5));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("tick with NaN HLC before any warmup returns NaN", () => {
        const bars = syntheticBars(1, 1);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () => atr("slot", 5));
        const last = bars[bars.length - 1];
        const head = tick(
            ctxRef,
            { ...last, high: Number.NaN, low: Number.NaN, close: Number.NaN },
            () => atr("slot", 5).current,
        );
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 1);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () => atr("slot", 5));
        const head = tick(ctxRef, bars[bars.length - 1], () => atr("slot", 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick on the seed bar returns the same seed value", () => {
        // After exactly `length` closes, trCount === length on the most
        // recent close — a tick replays the seed (the simple-mean seed
        // window is fixed once the bar closes).
        const bars = syntheticBars(5, 8);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () => atr("slot", 5));
        const closed = (
            ctxRef.ctx.stream.taSlots.get("slot") as {
                series: { current: number };
            }
        ).series.current;
        const last = bars[bars.length - 1];
        const head = tick(ctxRef, { ...last, high: last.high + 10 }, () => atr("slot", 5).current);
        expect(head).toBe(closed);
    });

    it("tick with NaN OHLC holds prior ATR", () => {
        const bars = syntheticBars(20, 1);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => atr("slot", 5));
        const closedHead = (
            ctxRef.ctx.stream.taSlots.get("slot") as {
                series: { current: number };
            }
        ).series.current;
        // Drive a tick with NaN high — the implementation should hold the
        // prior ATR.
        const last = bars[bars.length - 1];
        const head = tick(
            ctxRef,
            { ...last, high: Number.NaN, low: Number.NaN, close: Number.NaN },
            () => atr("slot", 5).current,
        );
        expect(head).toBeCloseTo(closedHead, 12);
    });
});
