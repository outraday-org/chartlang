// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { mfi } from "./mfi";

const mkBar = (high: number, low: number, close: number, volume: number, t = 0): Bar => ({
    time: 1_700_000_000_000 + t,
    open: close,
    high,
    low,
    close,
    volume,
    symbol: "T",
    interval: "1m",
});

describe("ta.mfi", () => {
    it("emits NaN through the warmup window (length + 1 bars total)", () => {
        // Steadily-rising bars so every comparison is positive.
        const bars: Bar[] = [];
        for (let i = 0; i < 8; i += 1) {
            const p = 100 + i;
            bars.push(mkBar(p + 1, p - 1, p, 1000, i * 60_000));
        }
        const out = harness(bars, bars.length + 1, () => mfi("slot", 5).current);
        // Window needs 5 (length) comparisons; first comparison lands
        // at bar 1. So bars 0..4 are NaN; bar 5 is first defined.
        for (let i = 0; i < 5; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[5])).toBe(true);
    });

    it("all-up flow → MFI = 100", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 10; i += 1) {
            const p = 100 + i;
            bars.push(mkBar(p + 1, p - 1, p, 1000, i * 60_000));
        }
        const out = harness(bars, bars.length + 1, () => mfi("slot", 3).current);
        // Once warm (bar 3 onward), all comparisons are tp > prevTp →
        // sumNeg = 0, sumPos > 0 → MFI = 100.
        for (let i = 3; i < bars.length; i += 1) expect(out[i]).toBe(100);
    });

    it("all-down flow → MFI = 0", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 10; i += 1) {
            const p = 200 - i;
            bars.push(mkBar(p + 1, p - 1, p, 1000, i * 60_000));
        }
        const out = harness(bars, bars.length + 1, () => mfi("slot", 3).current);
        for (let i = 3; i < bars.length; i += 1) expect(out[i]).toBe(0);
    });

    it("flat typical-price window → NaN (zero total)", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 8; i += 1) {
            // All bars identical → tp === prevTp → both buckets 0.
            bars.push(mkBar(101, 99, 100, 1000, i * 60_000));
        }
        const out = harness(bars, bars.length + 1, () => mfi("slot", 4).current);
        for (let i = 4; i < bars.length; i += 1) expect(Number.isNaN(out[i])).toBe(true);
    });

    it("NaN volume contributes 0 to both buckets", () => {
        const bars: Bar[] = [
            mkBar(102, 98, 100, 1000, 0),
            mkBar(103, 99, 101, 1000, 60_000),
            mkBar(104, 100, 102, Number.NaN, 120_000),
            mkBar(105, 101, 103, 1000, 180_000),
            mkBar(106, 102, 104, 1000, 240_000),
        ];
        const out = harness(bars, bars.length + 1, () => mfi("slot", 4).current);
        // Just verify the window does emit a defined finite value at
        // bar 4 (warmup ends) and that the NaN-volume bar didn't
        // poison the running sums.
        expect(Number.isFinite(out[4])).toBe(true);
        expect(out[4]).toBeGreaterThanOrEqual(0);
        expect(out[4]).toBeLessThanOrEqual(100);
    });

    it("returns the same Series identity on every call (offset === 0)", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            identities.add(mfi("slot", 5));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("returns a stable per-offset Series identity", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            identities.add(mfi("slot", 5, { offset: 3 }));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => mfi("oops", 14)).toThrowError(/ta.mfi called outside an active script step/);
    });
});

describe("ta.mfi tick-mode", () => {
    it("replaces the head without advancing the output length (post-warmup)", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 8; i += 1) {
            const p = 100 + i;
            bars.push(mkBar(p + 1, p - 1, p, 1000, i * 60_000));
        }
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => mfi("slot", 4));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar = mkBar(120, 118, 119, 1000, 7 * 60_000);
        tick(ctxRef, tickBar, () => mfi("slot", 4));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("pre-warmup tick emits NaN without polluting the window", () => {
        const bars: Bar[] = [mkBar(102, 98, 100, 1000, 0), mkBar(103, 99, 101, 1000, 60_000)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => mfi("slot", 5));
        const tickBar = mkBar(110, 108, 109, 5000, 60_000);
        const head = tick(ctxRef, tickBar, () => mfi("slot", 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });
});
