// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { bb } from "./bb";
import { computeRollingStdDev } from "./lib/rollingStddev";
import { computeSmaOfFloat64 } from "./lib/smaFloat64";

describe("ta.bb", () => {
    it("middle band matches SMA, upper/lower match SMA ± multiplier·σ", () => {
        const bars = syntheticBars(60, 21);
        const closes = new Float64Array(bars.map((b) => b.close));
        const expectedMid = computeSmaOfFloat64(closes, 10);
        const expectedSigma = computeRollingStdDev(closes, 10, true);
        const out = harness(bars, bars.length + 1, (bar) => {
            const r = bb("slot", bar.close, 10, { multiplier: 2 });
            return { mid: r.middle.current, upper: r.upper.current, lower: r.lower.current };
        });
        for (let i = 0; i < bars.length; i += 1) {
            const e = expectedMid[i];
            const s = expectedSigma[i];
            if (Number.isNaN(e)) {
                expect(Number.isNaN(out[i].mid)).toBe(true);
                expect(Number.isNaN(out[i].upper)).toBe(true);
                expect(Number.isNaN(out[i].lower)).toBe(true);
            } else {
                expect(out[i].mid).toBeCloseTo(e, 10);
                expect(out[i].upper).toBeCloseTo(e + 2 * s, 8);
                expect(out[i].lower).toBeCloseTo(e - 2 * s, 8);
            }
        }
    });

    it("defaults multiplier to 2", () => {
        const bars = syntheticBars(30, 4);
        const out = harness(bars, bars.length + 1, (bar) => {
            const r = bb("slot", bar.close, 5);
            return { mid: r.middle.current, upper: r.upper.current };
        });
        // Sanity: upper >= mid past warmup (sigma >= 0 for our synthetic walk).
        expect(out[bars.length - 1].upper).toBeGreaterThanOrEqual(out[bars.length - 1].mid);
    });

    it("returns the same BbResult identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const r = bb("slot", bar.close, 3);
            ids.add(r);
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => bb("oops", 1, 3)).toThrowError(/ta.bb called outside an active script step/);
    });

    it("emits all-NaN until warmup completes", () => {
        const bars = syntheticBars(8, 1);
        // BB depends on stdev which defaults to sample (denom = length-1). With
        // a constant series stdev = 0; with our walk it's > 0. Either way the
        // first defined value comes at i = length - 1 = 4.
        const out = harness(bars, bars.length + 1, (bar) => {
            const r = bb("slot", bar.close, 5);
            return { upper: r.upper.current, lower: r.lower.current };
        });
        for (let i = 0; i < 4; i += 1) {
            expect(Number.isNaN(out[i].upper)).toBe(true);
            expect(Number.isNaN(out[i].lower)).toBe(true);
        }
        expect(Number.isFinite(out[4].upper)).toBe(true);
        expect(Number.isFinite(out[4].lower)).toBe(true);
    });

    it("upper / lower follow the composed middle / sigma", () => {
        const bars = syntheticBars(20, 8).map((b, i) =>
            i === 10 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => {
            const r = bb("slot", bar.close, 5);
            return { u: r.upper.current, l: r.lower.current, m: r.middle.current };
        });
        // SMA holds the prior mean on NaN; stdev does too. So upper/lower hold
        // their prior values across the NaN bar.
        expect(out[10].u).toBeCloseTo(out[9].u, 12);
    });
});

describe("ta.bb tick-mode", () => {
    it("replaces the head without advancing output length", () => {
        const bars = syntheticBars(20, 7);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) => bb("slot", bar.close, 5));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickClose = bars[bars.length - 1].close + 10;
        tick(ctxRef, { ...bars[bars.length - 1], close: tickClose }, () =>
            bb("slot", tickClose, 5),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });
});

describe("ta.bb — opts.offset", () => {
    it("offset === 0 returns the same BbResult identity as no opts", () => {
        const bars = syntheticBars(20, 7);
        const identities = new Set<unknown>();
        let toggle = false;
        harness(bars, bars.length + 1, (bar) => {
            toggle = !toggle;
            identities.add(
                toggle ? bb("slot", bar.close, 5) : bb("slot", bar.close, 5, { offset: 0 }),
            );
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("offset === k > 0 shifts upper / middle / lower in lockstep", () => {
        const bars = syntheticBars(30, 11);
        const unshifted = harness(bars, bars.length + 1, (bar) => {
            const r = bb("slot", bar.close, 5);
            return { u: r.upper.current, m: r.middle.current, l: r.lower.current };
        });
        const shifted = harness(bars, bars.length + 1, (bar) => {
            const r = bb("slot", bar.close, 5, { offset: 3 });
            return { u: r.upper.current, m: r.middle.current, l: r.lower.current };
        });
        for (let i = 3; i < bars.length; i += 1) {
            const u = unshifted[i - 3];
            const s = shifted[i];
            for (const k of ["u", "m", "l"] as const) {
                if (Number.isNaN(u[k])) expect(Number.isNaN(s[k])).toBe(true);
                else expect(s[k]).toBeCloseTo(u[k], 12);
            }
        }
    });

    it("offset === -k returns NaN at the head for all three bands", () => {
        const bars = syntheticBars(20, 1);
        const head = harness(bars, bars.length + 1, (bar) => {
            const r = bb("slot", bar.close, 5, { offset: -2 });
            return { u: r.upper.current, m: r.middle.current, l: r.lower.current };
        });
        const last = head[head.length - 1];
        expect(Number.isNaN(last.u)).toBe(true);
        expect(Number.isNaN(last.m)).toBe(true);
        expect(Number.isNaN(last.l)).toBe(true);
    });

    it("two calls with the same non-zero offset return the same BbResult identity", () => {
        const bars = syntheticBars(10, 3);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(bb("slot", bar.close, 5, { offset: 2 }));
            return null;
        });
        expect(identities.size).toBe(1);
    });
});
