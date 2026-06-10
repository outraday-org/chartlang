// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { cmo } from "./cmo.js";

function bruteForceCmo(closes: number[], length: number, atIdx: number): number {
    let sumGain = 0;
    let sumLoss = 0;
    for (let j = atIdx - length + 1; j <= atIdx; j += 1) {
        const diff = closes[j] - closes[j - 1];
        if (diff > 0) sumGain += diff;
        else sumLoss += -diff;
    }
    const denom = sumGain + sumLoss;
    if (denom === 0) return Number.NaN;
    return (100 * (sumGain - sumLoss)) / denom;
}

describe("ta.cmo", () => {
    it("emits NaN for the first `length` bars", () => {
        const bars = syntheticBars(20, 7);
        const length = 5;
        const out = harness(bars, bars.length + 1, (bar) => cmo("slot", bar.close, length).current);
        for (let i = 0; i < length; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[length])).toBe(true);
    });

    it("matches the brute-force window CMO", () => {
        const bars = syntheticBars(30, 11);
        const length = 9;
        const out = harness(bars, bars.length + 1, (bar) => cmo("slot", bar.close, length).current);
        const closes = bars.map((b) => b.close);
        for (let i = length; i < bars.length; i += 1) {
            expect(out[i]).toBeCloseTo(bruteForceCmo(closes, length, i), 9);
        }
    });

    it("output is bounded in [-100, 100]", () => {
        const bars = syntheticBars(50, 4);
        const out = harness(bars, bars.length + 1, (bar) => cmo("slot", bar.close, 9).current);
        for (const v of out) {
            if (!Number.isFinite(v)) continue;
            expect(v).toBeGreaterThanOrEqual(-100);
            expect(v).toBeLessThanOrEqual(100);
        }
    });

    it("emits NaN on a flat-line input (zero denominator)", () => {
        const bars = syntheticBars(20, 1).map((b) => ({ ...b, close: 100 }));
        const out = harness(bars, bars.length + 1, (bar) => cmo("slot", bar.close, 5).current);
        // After warmup, all-flat input has zero gain + zero loss → NaN.
        for (let i = 5; i < out.length; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
    });

    it("holds the prior CMO forward when a single bar is NaN", () => {
        const bars = syntheticBars(20, 3);
        const length = 5;
        // Mutate one bar past warmup to NaN.
        const mutBars = bars.map((b, i) => (i === 10 ? { ...b, close: Number.NaN } : b));
        const out = harness(
            mutBars,
            mutBars.length + 1,
            (bar) => cmo("slot", bar.close, length).current,
        );
        // At index 10, slot.prevSrc is finite (bar 9's close), so the
        // diff is NaN → skip path returns the prior CMO (the index-9
        // value).
        const prior = out[9];
        expect(out[10]).toBe(prior);
    });

    it("first valid bar (warmup boundary) seeds prevSrc then emits NaN at that bar", () => {
        const bars = syntheticBars(5, 1).map((b, i) => (i === 0 ? { ...b, close: Number.NaN } : b));
        const out = harness(bars, bars.length + 1, (bar) => cmo("slot", bar.close, 2).current);
        // Bar 0 NaN → skip; bar 1 first finite, prevSrc seeded → NaN;
        // bar 2 first real diff folded, window still warming → NaN;
        // bar 3 window length 2 → first emit.
        expect(Number.isNaN(out[0])).toBe(true);
        expect(Number.isNaN(out[1])).toBe(true);
        expect(Number.isNaN(out[2])).toBe(true);
        expect(Number.isFinite(out[3])).toBe(true);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(8, 2);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(cmo("slot", bar.close, 5));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => cmo("oops", 1, 5)).toThrowError(/ta.cmo called outside an active script step/);
    });
});

describe("ta.cmo tick-mode", () => {
    it("replaces the head with the swapped-diff CMO", () => {
        const bars = syntheticBars(20, 6);
        const length = 5;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            cmo("slot", bar.close, length),
        );
        const tickClose = bars[bars.length - 1].close + 8;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], close: tickClose },
            () => cmo("slot", tickClose, length).current,
        );
        // Brute force: replace bar[N-1].close with tickClose and recompute.
        const closes = bars.map((b) => b.close);
        closes[closes.length - 1] = tickClose;
        const expected = bruteForceCmo(closes, length, closes.length - 1);
        if (Number.isNaN(expected)) expect(Number.isNaN(head)).toBe(true);
        else expect(head).toBeCloseTo(expected, 9);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(2, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            cmo("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[1], () => cmo("slot", bars[1].close, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with a negative diff (loss branch) replays correctly", () => {
        const bars = syntheticBars(20, 8);
        const length = 5;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            cmo("slot", bar.close, length),
        );
        // Use a close below prevClosedSrc to force diff < 0 (loss branch).
        const prevClosedSrc = bars[bars.length - 2].close;
        const tickClose = prevClosedSrc - 7;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], close: tickClose },
            () => cmo("slot", tickClose, length).current,
        );
        const closes = bars.map((b) => b.close);
        closes[closes.length - 1] = tickClose;
        const expected = bruteForceCmo(closes, length, closes.length - 1);
        if (Number.isNaN(expected)) expect(Number.isNaN(head)).toBe(true);
        else expect(head).toBeCloseTo(expected, 9);
    });

    it("tick with NaN source returns the prior CMO", () => {
        const bars = syntheticBars(20, 1);
        const length = 5;
        const { ctxRef, results } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            cmo("slot", bar.close, length),
        );
        const priorCmo = results[results.length - 1].current;
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => cmo("slot", Number.NaN, length).current,
        );
        expect(head).toBe(priorCmo);
    });
});
