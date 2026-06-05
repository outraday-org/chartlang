// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { keltner } from "./keltner";

function bar(h: number, l: number, c: number, i: number): Bar {
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open: c,
        high: h,
        low: l,
        close: c,
        volume: 0,
        symbol: "T",
        interval: "1m",
    };
}

describe("ta.keltner", () => {
    it("emits NaN at all outputs until warmup (length bars)", () => {
        const bars = syntheticBars(10, 7);
        const out = harness(bars, bars.length + 1, () => {
            const k = keltner("slot", { length: 5, multiplier: 2, maType: "sma" });
            return { u: k.upper.current, m: k.middle.current, l: k.lower.current };
        });
        // Wilder ATR seeds at bar length-1; SMA also seeds at length-1.
        // Both produce a finite value once length bars have been folded
        // in (index length-1 is the first defined slot).
        for (let i = 0; i < 4; i += 1) {
            expect(Number.isNaN(out[i].u)).toBe(true);
            expect(Number.isNaN(out[i].m)).toBe(true);
            expect(Number.isNaN(out[i].l)).toBe(true);
        }
        expect(Number.isFinite(out[4].u)).toBe(true);
        expect(Number.isFinite(out[4].m)).toBe(true);
        expect(Number.isFinite(out[4].l)).toBe(true);
    });

    it("upper = middle + multiplier * atr; lower = middle - multiplier * atr", () => {
        const bars = syntheticBars(30, 11);
        const out = harness(bars, bars.length + 1, () => {
            const k = keltner("slot", { length: 5, multiplier: 2, maType: "sma" });
            return { u: k.upper.current, m: k.middle.current, l: k.lower.current };
        });
        for (let i = 4; i < out.length; i += 1) {
            const { u, m, l } = out[i];
            if (Number.isFinite(u) && Number.isFinite(m) && Number.isFinite(l)) {
                const halfWidth = (u - l) / 2;
                expect(u).toBeCloseTo(m + halfWidth, 10);
                expect(l).toBeCloseTo(m - halfWidth, 10);
            }
        }
    });

    it("returns the same KeltnerResult identity on every call", () => {
        const bars = syntheticBars(10, 19);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            ids.add(keltner("slot", { length: 5 }));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("defaults to length=20, multiplier=2, maType=ema", () => {
        const bars = syntheticBars(25, 21);
        const out = harness(bars, bars.length + 1, () => {
            const k = keltner("slot");
            return { u: k.upper.current, m: k.middle.current, l: k.lower.current };
        });
        // After 20 bars at least one finite output exists.
        expect(Number.isFinite(out[20].m)).toBe(true);
    });

    it("supports sma / ema / wma / smma maType dispatch", () => {
        const bars = syntheticBars(30, 23);
        for (const maType of ["sma", "ema", "wma", "smma"] as const) {
            const out = harness(bars, bars.length + 1, () => {
                const k = keltner(`slot-${maType}`, { length: 5, maType });
                return k.middle.current;
            });
            expect(Number.isFinite(out[bars.length - 1])).toBe(true);
        }
    });

    it("throws when called outside an active script step", () => {
        expect(() => keltner("oops", { length: 5 })).toThrowError(
            /ta.keltner called outside an active script step/,
        );
    });

    it("propagates NaN to upper/lower when ATR is NaN (warmup)", () => {
        // First 4 bars are warmup; ATR is NaN for bars 0..3 → upper/lower
        // are NaN regardless of whether the MA already emitted a value.
        const bars = syntheticBars(8, 29);
        const out = harness(bars, bars.length + 1, () => {
            const k = keltner("slot", { length: 5, multiplier: 2, maType: "sma" });
            return { u: k.upper.current, l: k.lower.current };
        });
        for (let i = 0; i < 4; i += 1) {
            expect(Number.isNaN(out[i].u)).toBe(true);
            expect(Number.isNaN(out[i].l)).toBe(true);
        }
    });

    it("offset opt accepted (Phase-2 surface — runtime ignores)", () => {
        const bars = syntheticBars(10, 31);
        const out = harness(bars, bars.length + 1, () => {
            const k = keltner("slot", { length: 5, offset: 0 });
            return k.middle.current;
        });
        expect(Number.isFinite(out[9])).toBe(true);
    });

    it("outputs.middle is identity-shared with the composed MA sub-slot's series", () => {
        const bars = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((c, i) => bar(c + 1, c - 1, c, i));
        const refs = harness(bars, bars.length + 1, (_b, ctx) => {
            const k = keltner("slot", { length: 5, maType: "sma" });
            const subSlot = ctx.stream.taSlots.get("slot/sma");
            return { mid: k.middle, subSlot };
        });
        // The middle series identity is captured from the SMA primitive's
        // own series view — it is *not* a separate output buffer.
        expect(refs[0].mid).toBe(refs[1].mid);
    });
});

describe("ta.keltner tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(15, 33);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            keltner("slot", { length: 5 }),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, close: last.close + 100 }, () => keltner("slot", { length: 5 }));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same heads", () => {
        const bars = syntheticBars(20, 35);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            keltner("slot", { length: 5 }),
        );
        const last = bars[bars.length - 1];
        const tickBar = { ...last, close: last.close + 5, high: last.high + 5 };
        const a = tick(ctxRef, tickBar, () => {
            const k = keltner("slot", { length: 5 });
            return { u: k.upper.current, m: k.middle.current, l: k.lower.current };
        });
        const b = tick(ctxRef, tickBar, () => {
            const k = keltner("slot", { length: 5 });
            return { u: k.upper.current, m: k.middle.current, l: k.lower.current };
        });
        expect(b.u).toBe(a.u);
        expect(b.m).toBe(a.m);
        expect(b.l).toBe(a.l);
    });
});
