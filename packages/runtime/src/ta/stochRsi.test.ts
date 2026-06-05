// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { stochRsi } from "./stochRsi";

describe("ta.stochRsi", () => {
    it("emits NaN through the warmup window (defaults 14, 14, 3, 3)", () => {
        const bars = syntheticBars(80, 5);
        // First several bars are NaN; precise warmup count depends on
        // the composed `ta.rsi` + `ta.highest`/`ta.lowest` + two SMAs.
        // Conservatively assert NaN for the first 15 bars (RSI alone
        // emits NaN through `rsiLength` = 14) and finite by tail.
        const out = harness(bars, bars.length + 1, (bar) => {
            const s = stochRsi("slot", bar.close);
            return { k: s.k.current, d: s.d.current };
        });
        for (let i = 0; i < 15; i += 1) expect(Number.isNaN(out[i].d)).toBe(true);
        expect(Number.isFinite(out[bars.length - 1].d)).toBe(true);
    });

    it("k ∈ [0, 100] and d ∈ [0, 100] after warmup (with tiny FP epsilon)", () => {
        const bars = syntheticBars(80, 7);
        const out = harness(bars, bars.length + 1, (bar) => {
            const s = stochRsi("slot", bar.close, {
                rsiLength: 5,
                stochLength: 5,
                kSmoothing: 2,
                dSmoothing: 2,
            });
            return { k: s.k.current, d: s.d.current };
        });
        // Smoothing-layer fp rounding can spill the boundary value by
        // ~ULP; pin the range with a tiny tolerance.
        const EPSILON = 1e-9;
        for (const { k, d } of out) {
            if (Number.isFinite(k)) {
                expect(k).toBeGreaterThanOrEqual(0 - EPSILON);
                expect(k).toBeLessThanOrEqual(100 + EPSILON);
            }
            if (Number.isFinite(d)) {
                expect(d).toBeGreaterThanOrEqual(0 - EPSILON);
                expect(d).toBeLessThanOrEqual(100 + EPSILON);
            }
        }
    });

    it("returns the same StochRsiResult identity on every call", () => {
        const bars = syntheticBars(40, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = stochRsi("slot", bar.close);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => stochRsi("oops", 1)).toThrowError(
            /ta.stochRsi called outside an active script step/,
        );
    });

    it("flat-line input — flat RSI range emits NaN at k (and d)", () => {
        const bars = Array.from({ length: 80 }, (_, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: 100,
            high: 100,
            low: 100,
            close: 100,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => {
            const s = stochRsi("slot", bar.close, {
                rsiLength: 5,
                stochLength: 5,
                kSmoothing: 2,
                dSmoothing: 2,
            });
            return { k: s.k.current, d: s.d.current };
        });
        // Once the RSI window is flat (constant close → zero gains/losses
        // → division by zero in RSI, then flat RSI series → flat
        // highest/lowest → NaN at k), `k` and `d` must stay NaN.
        for (let i = 20; i < bars.length; i += 1) {
            expect(Number.isNaN(out[i].k)).toBe(true);
            expect(Number.isNaN(out[i].d)).toBe(true);
        }
    });

    it("uses defaults (14, 14, 3, 3) when opts is omitted", () => {
        const bars = syntheticBars(80, 3);
        const out = harness(bars, bars.length + 1, (bar) => stochRsi("slot", bar.close).d.current);
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });

    it("respects custom opts", () => {
        const bars = syntheticBars(50, 8);
        const out = harness(bars, bars.length + 1, (bar) => {
            const s = stochRsi("slot", bar.close, {
                rsiLength: 7,
                stochLength: 7,
                kSmoothing: 2,
                dSmoothing: 2,
                offset: 0,
            });
            return s.d.current;
        });
        // Warmup roughly 7 + 7 + 2 + 2 − 4 = 14; defined at the tail.
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });
});

describe("ta.stochRsi tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(50, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            stochRsi("slot", bar.close),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar = { ...bars[bars.length - 1], close: bars[bars.length - 1].close + 5 };
        tick(ctxRef, tickBar, () => stochRsi("slot", tickBar.close));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });
});
