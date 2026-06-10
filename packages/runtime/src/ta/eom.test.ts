// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { eom } from "./eom.js";

const DIVISOR = 10000;

const mkBar = (
    high: number,
    low: number,
    volume: number,
    t = 0,
    close = (high + low) / 2,
): Bar => ({
    time: 1_700_000_000_000 + t,
    open: close,
    high,
    low,
    close,
    volume,
    symbol: "T",
    interval: "1m",
});

const rawEom = (high: number, low: number, volume: number, prevMid: number): number => {
    const range = high - low;
    if (range === 0) return Number.NaN;
    const boxRatio = volume / DIVISOR / range;
    if (boxRatio === 0) return Number.NaN;
    return ((high + low) / 2 - prevMid) / boxRatio;
};

describe("ta.eom", () => {
    it("emits NaN through the first `length` bars (window not full)", () => {
        const bars = Array.from({ length: 5 }, (_, i) => mkBar(110 + i, 90 - i, 100, i * 60_000));
        const out = harness(bars, bars.length + 1, () => eom("slot", 3).current);
        // length = 3 → first defined at bar 3.
        expect(Number.isNaN(out[0])).toBe(true);
        expect(Number.isNaN(out[1])).toBe(true);
        expect(Number.isNaN(out[2])).toBe(true);
        expect(Number.isFinite(out[3])).toBe(true);
    });

    it("first defined output matches the SMA of the rawEom window", () => {
        const bars = [
            mkBar(110, 90, 100, 0),
            mkBar(120, 95, 200, 60_000),
            mkBar(115, 100, 300, 120_000),
            mkBar(118, 102, 250, 180_000),
        ];
        const out = harness(bars, bars.length + 1, () => eom("slot", 3).current);
        // raw[0] = NaN (no prevMid).
        // raw[1] = ((120+95)/2 − (110+90)/2) / (200/10000 / (120-95))
        //        = (107.5 − 100) / (0.02 / 25) = 7.5 / 0.0008 = 9375.
        // raw[2] = ((115+100)/2 − (120+95)/2) / (300/10000 / (115-100))
        //        = (107.5 − 107.5) / (0.03 / 15) = 0 / 0.002 = 0.
        // raw[3] = ((118+102)/2 − (115+100)/2) / (250/10000 / (118-102))
        //        = (110 − 107.5) / (0.025 / 16) = 2.5 / 0.0015625 = 1600.
        // Window at bar 3: [raw1, raw2, raw3] = [9375, 0, 1600].
        // SMA = (9375 + 0 + 1600) / 3 = 3658.333…
        const r1 = rawEom(120, 95, 200, 100);
        const r2 = rawEom(115, 100, 300, 107.5);
        const r3 = rawEom(118, 102, 250, 107.5);
        expect(out[3]).toBeCloseTo((r1 + r2 + r3) / 3, 9);
    });

    it("zero-range bar emits NaN AND propagates NaN through `length` bars", () => {
        const bars = [
            mkBar(110, 90, 100, 0),
            mkBar(120, 95, 200, 60_000),
            mkBar(115, 100, 300, 120_000),
            mkBar(118, 102, 250, 180_000),
            mkBar(105, 105, 100, 240_000), // zero range → NaN raw.
            mkBar(118, 102, 250, 300_000),
            mkBar(120, 105, 200, 360_000),
        ];
        const out = harness(bars, bars.length + 1, () => eom("slot", 3).current);
        // bar 3: window [r1, r2, r3] → finite.
        // bar 4: window [r2, r3, NaN] → NaN.
        // bar 5: window [r3, NaN, r5] → NaN.
        // bar 6: window [NaN, r5, r6] → NaN.
        expect(Number.isFinite(out[3])).toBe(true);
        expect(Number.isNaN(out[4])).toBe(true);
        expect(Number.isNaN(out[5])).toBe(true);
        expect(Number.isNaN(out[6])).toBe(true);
    });

    it("zero-volume bar emits NaN (boxRatio = 0)", () => {
        const bars = [
            mkBar(110, 90, 100, 0),
            mkBar(120, 95, 200, 60_000),
            mkBar(115, 100, 0, 120_000), // zero volume → NaN raw.
            mkBar(118, 102, 250, 180_000),
        ];
        const out = harness(bars, bars.length + 1, () => eom("slot", 3).current);
        // bar 3: window [r1, NaN, r3] → NaN.
        expect(Number.isNaN(out[3])).toBe(true);
    });

    it("NaN volume contributes 0 (treated as zero-volume → NaN raw)", () => {
        const bars = [
            mkBar(110, 90, 100, 0),
            mkBar(120, 95, 200, 60_000),
            { ...mkBar(115, 100, Number.NaN, 120_000) },
            mkBar(118, 102, 250, 180_000),
        ];
        const out = harness(bars, bars.length + 1, () => eom("slot", 3).current);
        expect(Number.isNaN(out[3])).toBe(true);
    });

    it("returns the same Series identity on every call (offset === 0)", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            identities.add(eom("slot", 5));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("returns a stable per-offset Series identity", () => {
        const bars = syntheticBars(20, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            identities.add(eom("slot", 5, { offset: 3 }));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => eom("oops", 14)).toThrowError(/ta.eom called outside an active script step/);
    });
});

describe("ta.eom tick-mode", () => {
    it("replaces the head with the substituted-raw SMA without mutating the window", () => {
        const bars = [
            mkBar(110, 90, 100, 0),
            mkBar(120, 95, 200, 60_000),
            mkBar(115, 100, 300, 120_000),
            mkBar(118, 102, 250, 180_000),
        ];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => eom("slot", 3));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        // Tick at bar 3 with widened range + larger volume → different rawEom.
        const tickBar: Bar = mkBar(125, 95, 400, 180_000);
        const head = tick(ctxRef, tickBar, () => eom("slot", 3).current);
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
        // Window at bar 3 (post-close): [r3, r2, r1].
        // prevMid at bar 3 (prev-closed prevMid) is the bar-2 mid = 107.5.
        // Tick rawEom = ((125+95)/2 − 107.5) / (400/10000 / (125-95))
        //              = (110 − 107.5) / (0.04 / 30) = 2.5 / 0.001333… = 1875.
        // Substitute head (r3) with tickRaw.
        const r1 = rawEom(120, 95, 200, 100);
        const r2 = rawEom(115, 100, 300, 107.5);
        const tickRaw = rawEom(125, 95, 400, 107.5);
        // Hypothetical sum = (r1 + r2 + tickRaw); SMA = sum/3.
        expect(head).toBeCloseTo((r1 + r2 + tickRaw) / 3, 9);
    });

    it("pre-warmup tick emits NaN", () => {
        const bars = [mkBar(110, 90, 100, 0), mkBar(120, 95, 200, 60_000)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => eom("slot", 5));
        const tickBar: Bar = mkBar(120, 95, 200, 60_000);
        const head = tick(ctxRef, tickBar, () => eom("slot", 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with zero-range emits NaN", () => {
        const bars = [
            mkBar(110, 90, 100, 0),
            mkBar(120, 95, 200, 60_000),
            mkBar(115, 100, 300, 120_000),
            mkBar(118, 102, 250, 180_000),
        ];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => eom("slot", 3));
        const tickBar: Bar = mkBar(105, 105, 200, 180_000); // zero range.
        const head = tick(ctxRef, tickBar, () => eom("slot", 3).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick replaces a NaN head — hypothetical sum becomes defined if tick is finite", () => {
        // Build bars so the head slot in the closed window is NaN
        // (zero-range bar), then tick with a finite raw → defined emit.
        const bars = [
            mkBar(110, 90, 100, 0),
            mkBar(120, 95, 200, 60_000),
            mkBar(115, 100, 300, 120_000),
            mkBar(105, 105, 100, 180_000), // zero range → head NaN.
        ];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => eom("slot", 3));
        const tickBar: Bar = mkBar(120, 100, 400, 180_000); // tick: finite raw.
        const head = tick(ctxRef, tickBar, () => eom("slot", 3).current);
        // Window after bar 3: [NaN, r2, r1]. nanCount = 1.
        // Tick: headWasNaN=true, tickIsNaN=false → hypNan = 1 - 1 + 0 = 0
        // → emit hypSum/3 = (sum - 0 + tickRaw) / 3 = (r1+r2 + tickRaw)/3.
        const r1 = rawEom(120, 95, 200, 100);
        const r2 = rawEom(115, 100, 300, 107.5);
        const tickRaw = rawEom(120, 100, 400, 107.5);
        expect(head).toBeCloseTo((r1 + r2 + tickRaw) / 3, 9);
    });

    it("tick with NaN raw against a NaN head still emits NaN", () => {
        const bars = [
            mkBar(110, 90, 100, 0),
            mkBar(120, 95, 200, 60_000),
            mkBar(115, 100, 300, 120_000),
            mkBar(105, 105, 100, 180_000), // zero range → head NaN.
        ];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => eom("slot", 3));
        const tickBar: Bar = mkBar(105, 105, 400, 180_000); // tick: zero range.
        const head = tick(ctxRef, tickBar, () => eom("slot", 3).current);
        // headWasNaN=true, tickIsNaN=true → hypNan = 1 - 1 + 1 = 1 > 0 → NaN.
        expect(Number.isNaN(head)).toBe(true);
    });

    it("close-side NaN high/low carries prevMid forward", () => {
        const bars = [
            mkBar(110, 90, 100, 0),
            mkBar(120, 95, 200, 60_000),
            mkBar(115, 100, 300, 120_000),
            // NaN high → midpoint update skipped; raw is NaN.
            { ...mkBar(Number.NaN, 100, 250, 180_000) },
            mkBar(118, 102, 250, 240_000),
        ];
        const out = harness(bars, bars.length + 1, () => eom("slot", 3).current);
        // bar 3: raw is NaN (NaN high → rawEomAt returns NaN); window
        // [NaN, r2, r1] → NaN. prevMid stays at the bar-2 midpoint (107.5).
        // bar 4: raw computed against prevMid=107.5 → finite.
        expect(Number.isNaN(out[3])).toBe(true);
        // bar 4: window [r4, NaN, r2] → NaN (window still contains the
        // NaN from bar 3).
        expect(Number.isNaN(out[4])).toBe(true);
    });

    it("two identical ticks produce the same head", () => {
        const bars = [
            mkBar(110, 90, 100, 0),
            mkBar(120, 95, 200, 60_000),
            mkBar(115, 100, 300, 120_000),
            mkBar(118, 102, 250, 180_000),
        ];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => eom("slot", 3));
        const tickBar: Bar = mkBar(125, 95, 400, 180_000);
        let a = 0;
        let b = 0;
        tick(ctxRef, tickBar, () => {
            a = eom("slot", 3).current;
            return a;
        });
        tick(ctxRef, tickBar, () => {
            b = eom("slot", 3).current;
            return b;
        });
        expect(b).toBeCloseTo(a, 12);
    });
});
