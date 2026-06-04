// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { computeEmaOfFloat64 } from "./lib/emaFloat64";
import { macd } from "./macd";

describe("ta.macd", () => {
    it("MACD line equals ema(src, fast) − ema(src, slow)", () => {
        const bars = syntheticBars(80, 31);
        const closes = new Float64Array(bars.map((b) => b.close));
        const fast = computeEmaOfFloat64(closes, 12);
        const slow = computeEmaOfFloat64(closes, 26);
        const out = harness(bars, bars.length + 1, (bar) => macd("slot", bar.close).macd.current);
        for (let i = 0; i < bars.length; i += 1) {
            const expected =
                Number.isFinite(fast[i]) && Number.isFinite(slow[i])
                    ? fast[i] - slow[i]
                    : Number.NaN;
            const actual = out[i];
            if (Number.isNaN(expected)) expect(Number.isNaN(actual)).toBe(true);
            else expect(actual).toBeCloseTo(expected, 8);
        }
    });

    it("hist equals macd − signal where both are defined", () => {
        const bars = syntheticBars(80, 32);
        const out = harness(bars, bars.length + 1, (bar) => {
            const r = macd("slot", bar.close);
            return { m: r.macd.current, s: r.signal.current, h: r.hist.current };
        });
        const last = out[out.length - 1];
        if (Number.isFinite(last.m) && Number.isFinite(last.s)) {
            expect(last.h).toBeCloseTo(last.m - last.s, 12);
        }
    });

    it("returns the same MacdResult identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            ids.add(macd("slot", bar.close));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => macd("oops", 1)).toThrowError(/ta.macd called outside an active script step/);
    });

    it("honours custom lengths", () => {
        const bars = syntheticBars(60, 33);
        const closes = new Float64Array(bars.map((b) => b.close));
        const fast = computeEmaOfFloat64(closes, 5);
        const slow = computeEmaOfFloat64(closes, 13);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) =>
                macd("slot", bar.close, { fastLength: 5, slowLength: 13, signalLength: 3 }).macd
                    .current,
        );
        for (let i = 0; i < bars.length; i += 1) {
            const expected =
                Number.isFinite(fast[i]) && Number.isFinite(slow[i])
                    ? fast[i] - slow[i]
                    : Number.NaN;
            const actual = out[i];
            if (Number.isNaN(expected)) expect(Number.isNaN(actual)).toBe(true);
            else expect(actual).toBeCloseTo(expected, 8);
        }
    });
});

describe("ta.macd tick-mode", () => {
    it("replaces the head without advancing length", () => {
        const bars = syntheticBars(60, 41);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) => macd("slot", bar.close));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickClose = bars[bars.length - 1].close + 10;
        tick(ctxRef, { ...bars[bars.length - 1], close: tickClose }, () => macd("slot", tickClose));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });
});
