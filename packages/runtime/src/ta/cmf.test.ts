// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { cmf } from "./cmf.js";

const mkBar = (
    open: number,
    high: number,
    low: number,
    close: number,
    volume = 100,
    timeOffset = 0,
): Bar => ({
    time: 1_700_000_000_000 + timeOffset,
    open,
    high,
    low,
    close,
    volume,
    symbol: "T",
    interval: "1m",
});

const mfv = (close: number, high: number, low: number, volume: number): number => {
    const range = high - low;
    if (range === 0) return 0;
    return ((close - low - (high - close)) / range) * volume;
};

describe("ta.cmf", () => {
    it("emits NaN through the first `length - 1` bars", () => {
        const bars = Array.from({ length: 5 }, (_, i) =>
            mkBar(100, 110 + i, 90, 100 + i, 100, i * 60_000),
        );
        const out = harness(bars, bars.length + 1, () => cmf("slot", 5).current);
        for (let i = 0; i < 4; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[4])).toBe(true);
    });

    it("first defined output equals Σ MFV / Σ vol over the window", () => {
        const bars = [
            mkBar(100, 110, 90, 105, 100, 0),
            mkBar(105, 115, 95, 100, 200, 60_000),
            mkBar(100, 102, 98, 101, 300, 120_000),
        ];
        const mfvs = bars.map((b) => mfv(b.close, b.high, b.low, b.volume));
        const vols = bars.map((b) => b.volume);
        const out = harness(bars, bars.length + 1, () => cmf("slot", 3).current);
        const sumMfv = mfvs.reduce((s, v) => s + v, 0);
        const sumVol = vols.reduce((s, v) => s + v, 0);
        expect(out[0]).toBeNaN();
        expect(out[1]).toBeNaN();
        expect(out[2]).toBeCloseTo(sumMfv / sumVol, 12);
    });

    it("slides correctly over a longer series (window length 3)", () => {
        const bars = [
            mkBar(100, 110, 90, 105, 100, 0),
            mkBar(105, 115, 95, 100, 200, 60_000),
            mkBar(100, 102, 98, 101, 300, 120_000),
            mkBar(101, 108, 99, 107, 400, 180_000),
        ];
        const mfvs = bars.map((b) => mfv(b.close, b.high, b.low, b.volume));
        const vols = bars.map((b) => b.volume);
        const out = harness(bars, bars.length + 1, () => cmf("slot", 3).current);
        // Bar 3 window: [bar1, bar2, bar3].
        const sumMfv13 = mfvs[1] + mfvs[2] + mfvs[3];
        const sumVol13 = vols[1] + vols[2] + vols[3];
        expect(out[3]).toBeCloseTo(sumMfv13 / sumVol13, 12);
    });

    it("zero-volume window emits NaN", () => {
        const bars = [
            mkBar(100, 110, 90, 105, 0, 0),
            mkBar(105, 115, 95, 100, 0, 60_000),
            mkBar(100, 102, 98, 101, 0, 120_000),
        ];
        const out = harness(bars, bars.length + 1, () => cmf("slot", 3).current);
        expect(Number.isNaN(out[2])).toBe(true);
    });

    it("NaN volume contributes 0 to both numerator and denominator", () => {
        const bars = [
            mkBar(100, 110, 90, 105, 100, 0),
            { ...mkBar(105, 115, 95, 100, Number.NaN, 60_000) },
            mkBar(100, 102, 98, 101, 300, 120_000),
        ];
        const expectedNum = mfv(105, 110, 90, 100) + 0 + mfv(101, 102, 98, 300);
        const expectedDen = 100 + 0 + 300;
        const out = harness(bars, bars.length + 1, () => cmf("slot", 3).current);
        expect(out[2]).toBeCloseTo(expectedNum / expectedDen, 12);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 3);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            identities.add(cmf("slot", 5));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => cmf("oops", 5)).toThrowError(/ta.cmf called outside an active script step/);
    });
});

describe("ta.cmf tick-mode", () => {
    it("replaces the head with the substituted-MFV ratio without mutating the window", () => {
        const bars = [
            mkBar(100, 110, 90, 105, 100, 0),
            mkBar(105, 115, 95, 100, 200, 60_000),
            mkBar(100, 102, 98, 101, 300, 120_000),
        ];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => cmf("slot", 3));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        // Tick at bar 2 with close=99 (other OHLC same), volume=350.
        const tickBar: Bar = mkBar(100, 102, 98, 99, 350, 120_000);
        const tickMfv = mfv(99, 102, 98, 350);
        // Window [bar0, bar1, bar2]; substitute bar2's contribution.
        const sumMfvHyp = mfv(105, 110, 90, 100) + mfv(100, 115, 95, 200) + tickMfv;
        const sumVolHyp = 100 + 200 + 350;
        const head = tick(ctxRef, tickBar, () => cmf("slot", 3).current);
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
        expect(head).toBeCloseTo(sumMfvHyp / sumVolHyp, 12);
    });

    it("pre-warmup tick emits NaN", () => {
        const bars = [mkBar(100, 110, 90, 105, 100, 0), mkBar(105, 115, 95, 100, 200, 60_000)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => cmf("slot", 5));
        const tickBar: Bar = mkBar(105, 115, 95, 110, 200, 60_000);
        const head = tick(ctxRef, tickBar, () => cmf("slot", 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("two identical ticks produce the same head", () => {
        const bars = [
            mkBar(100, 110, 90, 105, 100, 0),
            mkBar(105, 115, 95, 100, 200, 60_000),
            mkBar(100, 102, 98, 101, 300, 120_000),
        ];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => cmf("slot", 3));
        const tickBar: Bar = mkBar(100, 102, 98, 100, 100, 120_000);
        let a = 0;
        let b = 0;
        tick(ctxRef, tickBar, () => {
            a = cmf("slot", 3).current;
            return a;
        });
        tick(ctxRef, tickBar, () => {
            b = cmf("slot", 3).current;
            return b;
        });
        expect(b).toBeCloseTo(a, 12);
    });
});
