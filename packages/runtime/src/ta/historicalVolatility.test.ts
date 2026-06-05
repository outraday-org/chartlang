// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { historicalVolatility } from "./historicalVolatility";

function referenceHv(closes: ReadonlyArray<number>, length: number, ann: number): number[] {
    const out: number[] = [];
    const logReturns: number[] = [];
    for (let i = 0; i < closes.length; i += 1) {
        const lr = i === 0 ? Number.NaN : Math.log(closes[i] / closes[i - 1]);
        logReturns.push(lr);
        if (i < length) {
            out.push(Number.NaN);
            continue;
        }
        let sum = 0;
        let allFinite = true;
        for (let j = i - length + 1; j <= i; j += 1) {
            if (!Number.isFinite(logReturns[j])) {
                allFinite = false;
                break;
            }
            sum += logReturns[j];
        }
        if (!allFinite) {
            out.push(Number.NaN);
            continue;
        }
        const mean = sum / length;
        let sumSq = 0;
        for (let j = i - length + 1; j <= i; j += 1) {
            const d = logReturns[j] - mean;
            sumSq += d * d;
        }
        const sd = Math.sqrt(sumSq / length);
        out.push(sd * Math.sqrt(ann) * 100);
    }
    return out;
}

describe("ta.historicalVolatility", () => {
    it("emits NaN until warmup completes (length closed bars)", () => {
        const bars = syntheticBars(15, 4);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => historicalVolatility("slot", bar.close, 5).current,
        );
        for (let i = 0; i < 5; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[5])).toBe(true);
    });

    it("matches the reference rolling-stddev × sqrt(annualisation) × 100", () => {
        const bars = syntheticBars(50, 19);
        const closes = bars.map((b) => b.close);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) =>
                historicalVolatility("slot", bar.close, 10, { annualisationFactor: 252 }).current,
        );
        const expected = referenceHv(closes, 10, 252);
        for (let i = 0; i < bars.length; i += 1) {
            if (Number.isNaN(expected[i])) {
                expect(Number.isNaN(out[i])).toBe(true);
            } else {
                expect(out[i]).toBeCloseTo(expected[i], 9);
            }
        }
    });

    it("defaults annualisationFactor to 365", () => {
        const bars = syntheticBars(30, 7);
        const a = harness(
            bars,
            bars.length + 1,
            (bar) => historicalVolatility("a", bar.close, 10).current,
        );
        const b = harness(
            bars,
            bars.length + 1,
            (bar) => historicalVolatility("b", bar.close, 10, { annualisationFactor: 365 }).current,
        );
        for (let i = 0; i < bars.length; i += 1) {
            if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
            else expect(a[i]).toBeCloseTo(b[i], 12);
        }
    });

    it("emits non-negative values when defined (positive sources)", () => {
        const bars = syntheticBars(30, 3);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => historicalVolatility("slot", bar.close, 5).current,
        );
        for (const v of out) {
            if (Number.isFinite(v)) expect(v).toBeGreaterThanOrEqual(0);
        }
    });

    it("emits 0 on a flat-close (zero log returns)", () => {
        const bars = syntheticBars(20, 8).map((b) => ({ ...b, close: 100 }));
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => historicalVolatility("slot", bar.close, 5).current,
        );
        for (let i = 5; i < bars.length; i += 1) expect(out[i]).toBe(0);
    });

    it("non-positive source poisons the window with NaN", () => {
        // Drive a few positive closes, then a zero, then more positives.
        const bars = syntheticBars(15, 9).map((b, i) => ({
            ...b,
            close: i === 7 ? 0 : 100 + i,
        }));
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => historicalVolatility("slot", bar.close, 4).current,
        );
        // Any window touching bar 7 (or bar 8, since the log-return at 8 also lands NaN)
        // should be NaN.
        for (let i = 7; i <= 11; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 6);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            ids.add(historicalVolatility("slot", bar.close, 5));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("supports offset, returning a stable shifted view", () => {
        const bars = syntheticBars(20, 11);
        let viewA: unknown = null;
        let viewB: unknown = null;
        harness(bars, bars.length + 1, (bar) => {
            viewA = historicalVolatility("slot", bar.close, 5, { offset: 0 });
            viewB = historicalVolatility("slot", bar.close, 5, { offset: 2 });
            return null;
        });
        expect(viewA).not.toBe(viewB);
        // Identity is stable across calls.
        harness(bars, bars.length + 1, (bar) => {
            const a2 = historicalVolatility("s2", bar.close, 5, { offset: 3 });
            const a3 = historicalVolatility("s2", bar.close, 5, { offset: 3 });
            expect(a2).toBe(a3);
            return null;
        });
    });

    it("throws when called outside an active script step", () => {
        expect(() => historicalVolatility("oops", 1, 5)).toThrowError(
            /ta.historicalVolatility called outside an active script step/,
        );
    });

    it("NaN source → NaN output", () => {
        const bars = syntheticBars(15, 5);
        const out = harness(
            bars,
            bars.length + 1,
            () => historicalVolatility("slot", Number.NaN, 5).current,
        );
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });
});

describe("ta.historicalVolatility tick-mode", () => {
    it("replaces the head without advancing output length", () => {
        const bars = syntheticBars(15, 12);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            historicalVolatility("slot", bar.close, 5),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, close: last.close + 10 }, () =>
            historicalVolatility("slot", last.close + 10, 5),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("identical ticks produce the same head", () => {
        const bars = syntheticBars(15, 14);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            historicalVolatility("slot", bar.close, 5),
        );
        const last = bars[bars.length - 1];
        const tickClose = last.close + 7;
        const a = tick(
            ctxRef,
            { ...last, close: tickClose },
            () => historicalVolatility("slot", tickClose, 5).current,
        );
        const b = tick(
            ctxRef,
            { ...last, close: tickClose },
            () => historicalVolatility("slot", tickClose, 5).current,
        );
        expect(b).toBe(a);
    });

    it("tick before warmup returns NaN", () => {
        const bars = syntheticBars(3, 22);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            historicalVolatility("slot", bar.close, 10),
        );
        const last = bars[bars.length - 1];
        const v = tick(
            ctxRef,
            { ...last, close: last.close + 1 },
            () => historicalVolatility("slot", last.close + 1, 10).current,
        );
        expect(Number.isNaN(v)).toBe(true);
    });

    it("tick with NaN source short-circuits to NaN at the head", () => {
        const bars = syntheticBars(20, 33);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            historicalVolatility("slot", bar.close, 5),
        );
        const last = bars[bars.length - 1];
        const v = tick(
            ctxRef,
            { ...last },
            () => historicalVolatility("slot", Number.NaN, 5).current,
        );
        expect(Number.isNaN(v)).toBe(true);
    });
});
