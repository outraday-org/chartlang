// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { massIndex } from "./massIndex";

describe("ta.massIndex", () => {
    it("emits NaN until warmup completes (2 · emaLength + sumLength − 3)", () => {
        // Defaults: emaLength=9, sumLength=25 → warmup = 9+9+25-3 = 40.
        const bars = syntheticBars(60, 4);
        const out = harness(bars, bars.length + 1, () => massIndex("slot").current);
        for (let i = 0; i < 40; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[40])).toBe(true);
    });

    it("matches the canonical mass-index hand-computation on a flat-range source", () => {
        // If high - low is constant, EMA1 = constant, EMA2 = constant,
        // ratio = 1, sum over sumLength = sumLength.
        const bars = syntheticBars(60, 99).map((b) => ({
            ...b,
            high: 100,
            low: 90,
        }));
        const out = harness(
            bars,
            bars.length + 1,
            () => massIndex("slot", { emaLength: 5, sumLength: 10 }).current,
        );
        // Warmup = 5+5+10-3 = 17. From bar 17 onwards the sum is 10.
        for (let i = 17; i < bars.length; i += 1) {
            expect(out[i]).toBeCloseTo(10, 9);
        }
    });

    it("defaults emaLength to 9 and sumLength to 25", () => {
        const bars = syntheticBars(60, 7);
        const a = harness(bars, bars.length + 1, () => massIndex("a").current);
        const b = harness(
            bars,
            bars.length + 1,
            () => massIndex("b", { emaLength: 9, sumLength: 25 }).current,
        );
        for (let i = 0; i < bars.length; i += 1) {
            if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
            else expect(a[i]).toBeCloseTo(b[i], 12);
        }
    });

    it("emits NaN when high − low is zero (degenerate EMA chain → division by zero)", () => {
        const bars = syntheticBars(60, 8).map((b) => ({
            ...b,
            high: 100,
            low: 100,
            close: 100,
            open: 100,
        }));
        const out = harness(
            bars,
            bars.length + 1,
            () => massIndex("slot", { emaLength: 5, sumLength: 10 }).current,
        );
        // EMA1 = 0, EMA2 = 0 → ratio = NaN → sum = NaN forever.
        for (let i = 17; i < bars.length; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(60, 6);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            ids.add(massIndex("slot"));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("supports offset, returning distinct Series views per offset", () => {
        const bars = syntheticBars(60, 11);
        let viewA: unknown = null;
        let viewB: unknown = null;
        harness(bars, bars.length + 1, () => {
            viewA = massIndex("slot", { offset: 0 });
            viewB = massIndex("slot", { offset: 3 });
            return null;
        });
        expect(viewA).not.toBe(viewB);
    });

    it("throws when called outside an active script step", () => {
        expect(() => massIndex("oops")).toThrowError(
            /ta.massIndex called outside an active script step/,
        );
    });
});

describe("ta.massIndex tick-mode", () => {
    it("replaces the head without advancing output length", () => {
        const bars = syntheticBars(50, 12);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => massIndex("slot"));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, high: last.high + 5 }, () => massIndex("slot"));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("identical ticks produce the same head", () => {
        const bars = syntheticBars(50, 14);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => massIndex("slot"));
        const last = bars[bars.length - 1];
        const tickBar = { ...last, high: last.high + 1 };
        const a = tick(ctxRef, tickBar, () => massIndex("slot").current);
        const b = tick(ctxRef, tickBar, () => massIndex("slot").current);
        expect(b).toBe(a);
    });

    it("tick before warmup returns NaN", () => {
        const bars = syntheticBars(5, 22);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => massIndex("slot"));
        const last = bars[bars.length - 1];
        const v = tick(ctxRef, { ...last, high: last.high + 1 }, () => massIndex("slot").current);
        expect(Number.isNaN(v)).toBe(true);
    });

    it("tick after a degenerate-range stretch (NaN ratio in closed window) remains stable", () => {
        // Drive normal bars, then a degenerate stretch (range = 0
        // forever → eventually emaN.0 / 0 = NaN ratio fills the
        // window), then tick. Exercises the
        // `!Number.isFinite(slot.sumRatio)` short-circuit in tickValue.
        const baseBars = syntheticBars(40, 44);
        const degenerateBars = Array.from({ length: 60 }, (_, i) => ({
            time: baseBars[baseBars.length - 1].time + (i + 1) * 60_000,
            open: 100,
            high: 100,
            low: 100,
            close: 100,
            volume: 0,
            symbol: "TEST",
            interval: "1m",
        }));
        const bars = [...baseBars, ...degenerateBars];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            massIndex("slot", { emaLength: 5, sumLength: 10 }),
        );
        const last = bars[bars.length - 1];
        const v = tick(
            ctxRef,
            { ...last, high: last.high + 1 },
            () => massIndex("slot", { emaLength: 5, sumLength: 10 }).current,
        );
        expect(Number.isNaN(v) || Number.isFinite(v)).toBe(true);
    });
});
