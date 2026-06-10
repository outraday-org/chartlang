// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { atr } from "./atr.js";
import { computeAtrSeries } from "./lib/trSeries.js";

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

describe("ta.atr — opts.offset", () => {
    it("offset === 0 returns the same Series identity as no opts", () => {
        const bars = syntheticBars(20, 7);
        const identities = new Set<unknown>();
        let toggle = false;
        harness(bars, bars.length + 1, () => {
            toggle = !toggle;
            identities.add(toggle ? atr("slot", 5) : atr("slot", 5, { offset: 0 }));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("offset === k > 0 shifts the series so .current returns the value k bars ago", () => {
        const bars = syntheticBars(30, 11);
        const unshifted = harness(bars, bars.length + 1, () => atr("slot", 5).current);
        const shifted = harness(bars, bars.length + 1, () => atr("slot", 5, { offset: 3 }).current);
        for (let i = 3; i < bars.length; i += 1) {
            const u = unshifted[i - 3];
            const s = shifted[i];
            if (Number.isNaN(u)) expect(Number.isNaN(s)).toBe(true);
            else expect(s).toBeCloseTo(u, 12);
        }
    });

    it("offset === -k returns NaN at the head", () => {
        const bars = syntheticBars(20, 1);
        const head = harness(bars, bars.length + 1, () => atr("slot", 5, { offset: -2 }).current);
        expect(Number.isNaN(head[head.length - 1])).toBe(true);
    });

    it("two calls with the same non-zero offset return the same Series identity", () => {
        const bars = syntheticBars(10, 3);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            identities.add(atr("slot", 5, { offset: 2 }));
            return null;
        });
        expect(identities.size).toBe(1);
    });
});
