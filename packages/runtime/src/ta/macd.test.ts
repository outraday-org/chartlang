// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { computeEmaOfFloat64 } from "./lib/emaFloat64.js";
import { macd } from "./macd.js";

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

describe("ta.macd — opts.offset", () => {
    it("offset === 0 returns the same MacdResult identity as no opts", () => {
        const bars = syntheticBars(40, 5);
        const identities = new Set<unknown>();
        let toggle = false;
        harness(bars, bars.length + 1, (bar) => {
            toggle = !toggle;
            identities.add(
                toggle ? macd("slot", bar.close) : macd("slot", bar.close, { offset: 0 }),
            );
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("offset === k > 0 leaves macd / signal / hist unshifted (presentation-only)", () => {
        const bars = syntheticBars(80, 11);
        const unshifted = harness(bars, bars.length + 1, (bar) => {
            const r = macd("slot", bar.close);
            return { m: r.macd.current, s: r.signal.current, h: r.hist.current };
        });
        const shifted = harness(bars, bars.length + 1, (bar) => {
            const r = macd("slot", bar.close, { offset: 3 });
            return { m: r.macd.current, s: r.signal.current, h: r.hist.current };
        });
        for (let i = 0; i < bars.length; i += 1) {
            const u = unshifted[i];
            const s = shifted[i];
            for (const k of ["m", "s", "h"] as const) {
                if (Number.isNaN(u[k])) expect(Number.isNaN(s[k])).toBe(true);
                else expect(s[k]).toBeCloseTo(u[k], 12);
            }
        }
    });

    it("offset === -k leaves all three outputs unshifted (no future read; presentation-only)", () => {
        const bars = syntheticBars(80, 1);
        const unshifted = harness(bars, bars.length + 1, (bar) => {
            const r = macd("slot", bar.close);
            return { m: r.macd.current, s: r.signal.current, h: r.hist.current };
        });
        const head = harness(bars, bars.length + 1, (bar) => {
            const r = macd("slot", bar.close, { offset: -2 });
            return { m: r.macd.current, s: r.signal.current, h: r.hist.current };
        });
        const last = head[head.length - 1];
        const ref = unshifted[unshifted.length - 1];
        for (const k of ["m", "s", "h"] as const) {
            expect(last[k]).toBeCloseTo(ref[k], 12);
            expect(Number.isNaN(last[k])).toBe(false);
        }
    });

    it("two calls with the same non-zero offset return the same MacdResult identity", () => {
        const bars = syntheticBars(40, 3);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(macd("slot", bar.close, { offset: 2 }));
            return null;
        });
        expect(identities.size).toBe(1);
    });
});
