// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { ultimateOsc } from "./ultimateOsc.js";

describe("ta.ultimateOsc", () => {
    it("emits NaN through the warmup window (defaults longLength = 28)", () => {
        const bars = syntheticBars(50, 5);
        const out = harness(bars, bars.length + 1, () => ultimateOsc("slot").current);
        // barCount < longLength → NaN. First defined output lands at
        // bar index longLength - 1 = 27 (the bar that makes barCount === longLength).
        for (let i = 0; i < 27; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });

    it("output ∈ [0, 100] (or NaN) for every emitted bar", () => {
        const bars = syntheticBars(80, 7);
        const out = harness(
            bars,
            bars.length + 1,
            () => ultimateOsc("slot", { shortLength: 3, mediumLength: 5, longLength: 7 }).current,
        );
        for (const v of out) {
            if (Number.isFinite(v)) {
                expect(v).toBeGreaterThanOrEqual(0);
                expect(v).toBeLessThanOrEqual(100);
            }
        }
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(30, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            const s = ultimateOsc("slot");
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => ultimateOsc("oops")).toThrowError(
            /ta.ultimateOsc called outside an active script step/,
        );
    });

    it("emits NaN on a flat-line input (zero-TR window)", () => {
        const bars = Array.from({ length: 40 }, (_, i) => ({
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
            () => ultimateOsc("slot", { shortLength: 3, mediumLength: 5, longLength: 7 }).current,
        );
        // Past warmup, every value should be NaN — every bp/tr is 0.
        for (let i = 7; i < bars.length; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
    });

    it("uses defaults (7, 14, 28) when opts is omitted", () => {
        const bars = syntheticBars(40, 3);
        const out = harness(bars, bars.length + 1, () => ultimateOsc("slot").current);
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });

    it("holds prior output across a NaN bar past warmup", () => {
        const bars = syntheticBars(40, 4).map((b, i) =>
            i === 35 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(
            bars,
            bars.length + 1,
            () => ultimateOsc("slot", { shortLength: 3, mediumLength: 5, longLength: 7 }).current,
        );
        expect(out[35]).toBeCloseTo(out[34], 10);
    });
});

describe("ta.ultimateOsc tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(40, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => ultimateOsc("slot"));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar = { ...bars[bars.length - 1], close: bars[bars.length - 1].close + 5 };
        tick(ctxRef, tickBar, () => ultimateOsc("slot"));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(40, 9);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => ultimateOsc("slot"));
        const tickBar = { ...bars[bars.length - 1], close: bars[bars.length - 1].close + 3 };
        const a = tick(ctxRef, tickBar, () => ultimateOsc("slot").current);
        const b = tick(ctxRef, tickBar, () => ultimateOsc("slot").current);
        expect(b).toBeCloseTo(a, 12);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(5, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () => ultimateOsc("slot"));
        const head = tick(ctxRef, bars[4], () => ultimateOsc("slot").current);
        expect(Number.isNaN(head)).toBe(true);
    });
});
