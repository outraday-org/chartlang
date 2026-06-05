// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { tsi } from "./tsi";

describe("ta.tsi", () => {
    it("emits NaN through the warmup window (defaults 25/13/13)", () => {
        const bars = syntheticBars(80, 9);
        const out = harness(bars, bars.length + 1, (bar) => {
            const t = tsi("slot", bar.close);
            return { tsi: t.tsi.current, signal: t.signal.current };
        });
        // tsi warmup ≥ 25 + 13 − 1 = 37 NaN bars; signal warmup ≥ 37 + 13 − 1 = 49.
        for (let i = 0; i < 37; i += 1) expect(Number.isNaN(out[i].tsi)).toBe(true);
        for (let i = 0; i < 49; i += 1) expect(Number.isNaN(out[i].signal)).toBe(true);
        expect(Number.isFinite(out[bars.length - 1].tsi)).toBe(true);
        expect(Number.isFinite(out[bars.length - 1].signal)).toBe(true);
    });

    it("tsi ∈ [-100, 100] after warmup (small FP epsilon)", () => {
        const bars = syntheticBars(80, 11);
        const out = harness(bars, bars.length + 1, (bar) => tsi("slot", bar.close).tsi.current);
        const EPSILON = 1e-9;
        for (const v of out) {
            if (Number.isFinite(v)) {
                expect(v).toBeGreaterThanOrEqual(-100 - EPSILON);
                expect(v).toBeLessThanOrEqual(100 + EPSILON);
            }
        }
    });

    it("returns the same TsiResult identity on every call", () => {
        const bars = syntheticBars(50, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(tsi("slot", bar.close));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("flat-line input → tsi stays NaN (zero absMom denominator)", () => {
        const bars: Bar[] = Array.from({ length: 60 }, (_, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: 100,
            high: 100,
            low: 100,
            close: 100,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => tsi("slot", bar.close).tsi.current);
        // After warmup the absMom EMA collapses to zero → tsi NaN.
        for (let i = 50; i < bars.length; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
    });

    it("respects custom opts", () => {
        const bars = syntheticBars(40, 4);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) =>
                tsi("slot", bar.close, {
                    firstSmoothing: 5,
                    secondSmoothing: 3,
                    signalLength: 3,
                }).signal.current,
        );
        // Warmup roughly 5 + 3 + 3 − 3 = 8 (per spec, signal-line).
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });

    it("throws when called outside an active script step", () => {
        expect(() => tsi("oops", 1)).toThrowError(/ta.tsi called outside an active script step/);
    });
});

describe("ta.tsi tick-mode", () => {
    it("replaces the head against the prev-closed source (consecutive ticks share anchor)", () => {
        const bars = syntheticBars(50, 6);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) => tsi("slot", bar.close));
        const before = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar = { ...bars[bars.length - 1], close: bars[bars.length - 1].close + 4 };
        tick(ctxRef, tickBar, () => tsi("slot", tickBar.close));
        expect(ctxRef.ctx.stream.ohlcv.close.length).toBe(before);
    });

    it("opts.offset > 0 returns a shifted view (identity-stable per offset)", () => {
        const bars = syntheticBars(60, 4);
        const out = harness(bars, bars.length + 1, (bar) => {
            const a = tsi("slot", bar.close, { offset: 2 });
            const b = tsi("slot", bar.close, { offset: 2 });
            return a === b;
        });
        for (const v of out) expect(v).toBe(true);
    });
});
