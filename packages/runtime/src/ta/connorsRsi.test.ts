// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { connorsRsi } from "./connorsRsi.js";

describe("ta.connorsRsi", () => {
    it("emits values in [0, 100] (or NaN) after warmup", () => {
        // Use a longer fixture so the rocLength=100 default has a chance
        // to fully populate.
        const bars = syntheticBars(150, 5);
        const out = harness(bars, bars.length + 1, (bar) => connorsRsi("slot", bar.close).current);
        for (const v of out) {
            if (Number.isFinite(v)) {
                expect(v).toBeGreaterThanOrEqual(0);
                expect(v).toBeLessThanOrEqual(100);
            }
        }
    });

    it("emits NaN through the early warmup (defaults 3, 2, 100)", () => {
        const bars = syntheticBars(150, 5);
        const out = harness(bars, bars.length + 1, (bar) => connorsRsi("slot", bar.close).current);
        // The first bar has no prev source; all three components
        // depend on at least one prior bar, so bar 0 must be NaN.
        expect(Number.isNaN(out[0])).toBe(true);
    });

    it("converges to a finite value once all three components seed (custom small opts)", () => {
        // Use small lengths so the full-warmup happens within the fixture.
        const bars = syntheticBars(40, 7);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) =>
                connorsRsi("slot", bar.close, {
                    rsiLength: 3,
                    streakLength: 2,
                    rocLength: 5,
                }).current,
        );
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });

    it("returns the same Series identity on every call (offset === 0)", () => {
        const bars = syntheticBars(30, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(connorsRsi("slot", bar.close));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("returns a stable per-offset Series identity", () => {
        const bars = syntheticBars(30, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(connorsRsi("slot", bar.close, { offset: 5 }));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => connorsRsi("oops", 1)).toThrowError(
            /ta.connorsRsi called outside an active script step/,
        );
    });

    it("uses defaults (3, 2, 100) when opts is omitted", () => {
        const bars = syntheticBars(150, 3);
        const out = harness(bars, bars.length + 1, (bar) => connorsRsi("slot", bar.close).current);
        // After 100+ bars the rocLength=100 PercentRank can settle;
        // assert a finite value somewhere in the tail.
        let sawFinite = false;
        for (let i = 110; i < bars.length; i += 1) {
            if (Number.isFinite(out[i])) {
                sawFinite = true;
                break;
            }
        }
        expect(sawFinite).toBe(true);
    });

    it("flat-line input — RSI components define, output stays finite", () => {
        // A perfectly flat price series: diff is always zero, streak
        // sign stays 0, ROC is zero. RSI(flat) → 100 (zero loss).
        const bars = Array.from({ length: 50 }, (_, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: 100,
            high: 100,
            low: 100,
            close: 100,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(
            bars,
            bars.length + 1,
            (bar) =>
                connorsRsi("slot", bar.close, {
                    rsiLength: 3,
                    streakLength: 2,
                    rocLength: 5,
                }).current,
        );
        // Once warmed up, the output should be finite (RSI(flat) = 100,
        // ROC = 0 → percent-rank fallback to 50). The sub-component-
        // skip semantic keeps the line defined.
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });

    it("respects custom opts (rsiLength=5, streakLength=3, rocLength=10)", () => {
        const bars = syntheticBars(50, 8);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) =>
                connorsRsi("slot", bar.close, {
                    rsiLength: 5,
                    streakLength: 3,
                    rocLength: 10,
                }).current,
        );
        // First defined output around max(5,3,10) + 1 = 11.
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });
});

describe("ta.connorsRsi tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(50, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            connorsRsi("slot", bar.close),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickClose = bars[bars.length - 1].close + 5;
        const tickBar = { ...bars[bars.length - 1], close: tickClose };
        tick(ctxRef, tickBar, () => connorsRsi("slot", tickClose));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(40, 9);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            connorsRsi("slot", bar.close, { rsiLength: 3, streakLength: 2, rocLength: 5 }),
        );
        const tickClose = bars[bars.length - 1].close + 3;
        const tickBar = { ...bars[bars.length - 1], close: tickClose };
        const a = tick(
            ctxRef,
            tickBar,
            () =>
                connorsRsi("slot", tickClose, { rsiLength: 3, streakLength: 2, rocLength: 5 })
                    .current,
        );
        const b = tick(
            ctxRef,
            tickBar,
            () =>
                connorsRsi("slot", tickClose, { rsiLength: 3, streakLength: 2, rocLength: 5 })
                    .current,
        );
        if (Number.isFinite(a) && Number.isFinite(b)) {
            expect(b).toBeCloseTo(a, 12);
        } else {
            expect(Number.isNaN(a)).toBe(Number.isNaN(b));
        }
    });
});
