// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { computeRollingStdDev } from "./lib/rollingStddev.js";
import { stdev } from "./stdev.js";

describe("ta.stdev", () => {
    it("matches computeRollingStdDev (population) over a 50-bar synthetic walk", () => {
        const bars = syntheticBars(50, 13);
        const closes = new Float64Array(bars.map((b) => b.close));
        const expected = computeRollingStdDev(closes, 10, true);
        const actual = harness(
            bars,
            bars.length + 1,
            (bar) => stdev("slot", bar.close, 10, { biased: true }).current,
        );
        for (let i = 0; i < bars.length; i += 1) {
            const a = actual[i];
            const e = expected[i];
            if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
            else expect(a).toBeCloseTo(e, 8);
        }
    });

    it("defaults to sample stddev (denominator length - 1)", () => {
        const bars = syntheticBars(20, 17);
        const closes = new Float64Array(bars.map((b) => b.close));
        const expected = computeRollingStdDev(closes, 5, false);
        const actual = harness(bars, bars.length + 1, (bar) => stdev("slot", bar.close, 5).current);
        const last = expected[expected.length - 1];
        if (!Number.isNaN(last)) expect(actual[actual.length - 1]).toBeCloseTo(last, 8);
    });

    it("emits NaN until the window is filled", () => {
        const bars = syntheticBars(15, 5);
        const out = harness(bars, bars.length + 1, (bar) => stdev("slot", bar.close, 5).current);
        for (let i = 0; i < 4; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[4])).toBe(true);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = stdev("slot", bar.close, 3);
            ids.add(s);
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => stdev("oops", 1, 3)).toThrowError(
            /ta.stdev called outside an active script step/,
        );
    });

    it("returns NaN if length < 2 with biased=false (denominator <= 0)", () => {
        const bars = syntheticBars(5, 1);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => stdev("slot", bar.close, 1, { biased: false }).current,
        );
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("clamps tiny-negative variance to zero", () => {
        // A constant series should yield σ = 0 exactly.
        const bars = syntheticBars(10, 1).map((b) => ({ ...b, close: 100 }));
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => stdev("slot", bar.close, 3, { biased: true }).current,
        );
        for (let i = 2; i < bars.length; i += 1) {
            expect(out[i]).toBe(0);
        }
    });

    it("holds the prior stddev when source is NaN past warmup", () => {
        const bars = syntheticBars(20, 2).map((b, i) =>
            i === 12 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => stdev("slot", bar.close, 5, { biased: true }).current,
        );
        expect(out[12]).toBeCloseTo(out[11], 12);
    });

    it("returns NaN for NaN source during warmup", () => {
        const bars = syntheticBars(10, 6).map((b, i) =>
            i === 1 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => stdev("slot", bar.close, 4).current);
        expect(Number.isNaN(out[1])).toBe(true);
    });
});

describe("ta.stdev tick-mode", () => {
    it("replaces the head without advancing the window", () => {
        const bars = syntheticBars(20, 1);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            stdev("slot", bar.close, 5, { biased: true }),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickClose = bars[bars.length - 1].close + 5;
        tick(ctxRef, { ...bars[bars.length - 1], close: tickClose }, () =>
            stdev("slot", tickClose, 5, { biased: true }),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            stdev("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[2], () => stdev("slot", bars[2].close, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with NaN source returns NaN", () => {
        const bars = syntheticBars(20, 1);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            stdev("slot", bar.close, 5, { biased: true }),
        );
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => stdev("slot", Number.NaN, 5, { biased: true }).current,
        );
        expect(Number.isNaN(head)).toBe(true);
    });
});

describe("ta.stdev — opts.offset", () => {
    it("offset === 0 returns the same Series identity as no opts", () => {
        const bars = syntheticBars(20, 7);
        const identities = new Set<unknown>();
        let toggle = false;
        harness(bars, bars.length + 1, (bar) => {
            toggle = !toggle;
            identities.add(
                toggle
                    ? stdev("slot", bar.close, 5, { biased: true })
                    : stdev("slot", bar.close, 5, { biased: true, offset: 0 }),
            );
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("offset === k > 0 leaves .current unshifted (offset is presentation-only)", () => {
        const bars = syntheticBars(30, 11);
        const unshifted = harness(
            bars,
            bars.length + 1,
            (bar) => stdev("slot", bar.close, 5, { biased: true }).current,
        );
        const shifted = harness(
            bars,
            bars.length + 1,
            (bar) => stdev("slot", bar.close, 5, { biased: true, offset: 3 }).current,
        );
        for (let i = 0; i < bars.length; i += 1) {
            const u = unshifted[i];
            const s = shifted[i];
            if (Number.isNaN(u)) expect(Number.isNaN(s)).toBe(true);
            else expect(s).toBeCloseTo(u, 12);
        }
    });

    it("offset === -k leaves .current unshifted (no future read; presentation-only)", () => {
        const bars = syntheticBars(20, 1);
        const unshifted = harness(
            bars,
            bars.length + 1,
            (bar) => stdev("slot", bar.close, 5).current,
        );
        const head = harness(
            bars,
            bars.length + 1,
            (bar) => stdev("slot", bar.close, 5, { offset: -2 }).current,
        );
        expect(head[head.length - 1]).toBeCloseTo(unshifted[unshifted.length - 1], 12);
        expect(Number.isNaN(head[head.length - 1])).toBe(false);
    });

    it("two calls with the same non-zero offset return the same Series identity", () => {
        const bars = syntheticBars(10, 3);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(stdev("slot", bar.close, 5, { offset: 2 }));
            return null;
        });
        expect(identities.size).toBe(1);
    });
});
