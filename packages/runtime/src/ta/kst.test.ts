// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { kst } from "./kst";

describe("ta.kst", () => {
    it("emits NaN through the warmup window (defaults)", () => {
        const bars = syntheticBars(80, 5);
        const out = harness(bars, bars.length + 1, (bar) => {
            const k = kst("slot", bar.close);
            return { kst: k.kst.current, signal: k.signal.current };
        });
        // First defined kst at index `max(rocN + smoothN) - 1` = `30 + 15 - 1 = 44`
        // (for default opts). Warmup conservatively asserted at index 40.
        for (let i = 0; i < 40; i += 1) {
            expect(Number.isNaN(out[i].kst)).toBe(true);
        }
        expect(Number.isFinite(out[bars.length - 1].kst)).toBe(true);
        expect(Number.isFinite(out[bars.length - 1].signal)).toBe(true);
    });

    it("returns the same KstResult identity on every call", () => {
        const bars = syntheticBars(40, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(kst("slot", bar.close));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => kst("oops", 1)).toThrowError(/ta.kst called outside an active script step/);
    });

    it("propagates NaN when source is NaN", () => {
        const bars = syntheticBars(80, 9);
        const out = harness(bars, bars.length + 1, (bar, _ctx) => {
            const k = kst("slot", Number.NaN);
            return k.kst.current;
        });
        // With all-NaN sources every ROC is NaN, so kst is NaN forever.
        for (let i = 0; i < out.length; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
    });

    it("handles a zero-source bar without throwing (NaN guard)", () => {
        const bars = syntheticBars(80, 11);
        // Manually replace one bar's close with 0 to exercise pctRoc's
        // zero-lookback guard a few bars later.
        const mutated = bars.map((b, i) => (i === 5 ? { ...b, close: 0 } : b));
        const out = harness(
            mutated,
            mutated.length + 1,
            (bar) => kst("slot", bar.close).kst.current,
        );
        // Bar 5 has close = 0; for bar i where `i - rocN === 5` (rocN bars
        // after bar 5), pctRoc's lookback denominator is 0 → ROC NaN →
        // kst NaN at THAT bar.
        // We just assert no throw + the tail is finite or NaN (not Infinity).
        for (const v of out) {
            if (!Number.isNaN(v)) expect(Number.isFinite(v)).toBe(true);
        }
    });

    it("custom opts override defaults", () => {
        const bars = syntheticBars(50, 8);
        const out = harness(bars, bars.length + 1, (bar) => {
            const k = kst("slot", bar.close, {
                roc1Length: 3,
                roc2Length: 5,
                roc3Length: 7,
                roc4Length: 9,
                roc1Smooth: 3,
                roc2Smooth: 3,
                roc3Smooth: 3,
                roc4Smooth: 3,
                signalLength: 4,
            });
            return k.kst.current;
        });
        // Warmup `max(9 + 3) - 1 = 11`. Tail must be finite.
        expect(Number.isFinite(out[out.length - 1])).toBe(true);
        for (let i = 0; i < 5; i += 1) expect(Number.isNaN(out[i])).toBe(true);
    });
});

describe("ta.kst tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(50, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) => kst("slot", bar.close));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar = { ...bars[bars.length - 1], close: bars[bars.length - 1].close + 5 };
        tick(ctxRef, tickBar, () => kst("slot", tickBar.close));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });
});
