// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { vwap } from "./vwap.js";

const MS_PER_DAY = 86_400_000;

/**
 * Build bars whose times anchor to UTC midnight + a per-bar offset so
 * the day-boundary reset is exercised deterministically.
 */
function dayAnchoredBars(prices: ReadonlyArray<number>, volumes: ReadonlyArray<number>): Bar[] {
    const dayStart = Math.floor(1_700_000_000_000 / MS_PER_DAY) * MS_PER_DAY;
    return prices.map((p, i) => ({
        time: dayStart + i * 60_000,
        open: p,
        high: p,
        low: p,
        close: p,
        volume: volumes[i],
        symbol: "T",
        interval: "1m",
    }));
}

describe("ta.vwap", () => {
    it("first bar returns hlc3 when volume > 0 (cum trivially = price)", () => {
        const bars = dayAnchoredBars([100, 110, 120], [10, 20, 30]);
        const out = harness(bars, bars.length + 1, () => vwap("slot").current);
        expect(out[0]).toBeCloseTo(100, 12);
        // cum after bar 1: pv = 100*10 + 110*20 = 3200; v = 30 → 106.6667.
        expect(out[1]).toBeCloseTo((100 * 10 + 110 * 20) / 30, 12);
        // cum after bar 2: pv = 3200 + 120*30 = 6800; v = 60 → 113.3333.
        expect(out[2]).toBeCloseTo((100 * 10 + 110 * 20 + 120 * 30) / 60, 12);
    });

    it("emits NaN before any volume accumulates in a session", () => {
        const bars = dayAnchoredBars([100, 110], [0, 5]);
        const out = harness(bars, bars.length + 1, () => vwap("slot").current);
        expect(Number.isNaN(out[0])).toBe(true);
        expect(out[1]).toBeCloseTo(110, 12);
    });

    it("resets the accumulator at the UTC calendar-day boundary", () => {
        const dayA = Math.floor(1_700_000_000_000 / MS_PER_DAY) * MS_PER_DAY;
        const dayB = dayA + MS_PER_DAY;
        const bars: Bar[] = [
            {
                time: dayA,
                open: 100,
                high: 100,
                low: 100,
                close: 100,
                volume: 10,
                symbol: "T",
                interval: "1m",
            },
            {
                time: dayA + 60_000,
                open: 110,
                high: 110,
                low: 110,
                close: 110,
                volume: 20,
                symbol: "T",
                interval: "1m",
            },
            // Crossing into day B — accumulator resets.
            {
                time: dayB,
                open: 200,
                high: 200,
                low: 200,
                close: 200,
                volume: 5,
                symbol: "T",
                interval: "1m",
            },
            {
                time: dayB + 60_000,
                open: 210,
                high: 210,
                low: 210,
                close: 210,
                volume: 5,
                symbol: "T",
                interval: "1m",
            },
        ];
        const out = harness(bars, bars.length + 1, () => vwap("slot").current);
        expect(out[1]).toBeCloseTo((100 * 10 + 110 * 20) / 30, 12);
        // Bar 2 (first bar of day B) — accumulator reset; vwap = 200.
        expect(out[2]).toBeCloseTo(200, 12);
        expect(out[3]).toBeCloseTo((200 * 5 + 210 * 5) / 10, 12);
    });

    it("honours opts.source (close)", () => {
        const bars: Bar[] = [
            {
                time: 1_700_000_000_000,
                open: 50,
                high: 200,
                low: 0,
                close: 100,
                volume: 10,
                symbol: "T",
                interval: "1m",
            },
        ];
        const out = harness(bars, bars.length + 1, () => vwap("slot", { source: "close" }).current);
        expect(out[0]).toBeCloseTo(100, 12);
    });

    it("honours opts.source (hl2 / ohlc4 / hlcc4)", () => {
        const bars: Bar[] = [
            {
                time: 1_700_000_000_000,
                open: 50,
                high: 200,
                low: 0,
                close: 100,
                volume: 10,
                symbol: "T",
                interval: "1m",
            },
        ];
        const hl2 = harness(bars, bars.length + 1, () => vwap("slot", { source: "hl2" }).current);
        const ohlc4 = harness(
            bars,
            bars.length + 1,
            () => vwap("slot", { source: "ohlc4" }).current,
        );
        const hlcc4 = harness(
            bars,
            bars.length + 1,
            () => vwap("slot", { source: "hlcc4" }).current,
        );
        expect(hl2[0]).toBeCloseTo((200 + 0) / 2, 12);
        expect(ohlc4[0]).toBeCloseTo((50 + 200 + 0 + 100) / 4, 12);
        expect(hlcc4[0]).toBeCloseTo((200 + 0 + 100 + 100) / 4, 12);
    });

    it("skips bars with NaN source or zero / NaN volume", () => {
        const bars: Bar[] = [
            {
                time: 1_700_000_000_000,
                open: 100,
                high: 100,
                low: 100,
                close: 100,
                volume: 10,
                symbol: "T",
                interval: "1m",
            },
            {
                time: 1_700_000_060_000,
                open: Number.NaN,
                high: Number.NaN,
                low: Number.NaN,
                close: Number.NaN,
                volume: 5,
                symbol: "T",
                interval: "1m",
            },
            {
                time: 1_700_000_120_000,
                open: 120,
                high: 120,
                low: 120,
                close: 120,
                volume: 0,
                symbol: "T",
                interval: "1m",
            },
            {
                time: 1_700_000_180_000,
                open: 130,
                high: 130,
                low: 130,
                close: 130,
                volume: 10,
                symbol: "T",
                interval: "1m",
            },
        ];
        const out = harness(bars, bars.length + 1, () => vwap("slot").current);
        // Bar 0: 100; bar 1: NaN source skipped — accumulator unchanged → 100; bar 2: zero volume skipped → 100;
        // bar 3: contributes → (100*10 + 130*10) / 20 = 115.
        expect(out[0]).toBeCloseTo(100, 12);
        expect(out[1]).toBeCloseTo(100, 12);
        expect(out[2]).toBeCloseTo(100, 12);
        expect(out[3]).toBeCloseTo((100 * 10 + 130 * 10) / 20, 12);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 3);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            identities.add(vwap("slot"));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => vwap("oops")).toThrowError(/ta.vwap called outside an active script step/);
    });
});

describe("ta.vwap tick-mode", () => {
    it("replaces the head without polluting next close's accumulator", () => {
        const bars = dayAnchoredBars([100, 110, 120], [10, 20, 30]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => vwap("slot"));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar: Bar = { ...bars[bars.length - 1], close: 130, high: 130, low: 130 };
        const head = tick(ctxRef, tickBar, () => vwap("slot").current);
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
        // The tick replaces bar 2's contribution: prev-close cum was the
        // state after bar 1 (pv=3200, v=30); tick adds 130 * 30 = 3900.
        // Resulting vwap = (3200 + 3900) / (30 + 30) = 7100 / 60 ≈ 118.333.
        expect(head).toBeCloseTo((100 * 10 + 110 * 20 + 130 * 30) / 60, 12);
    });

    it("two identical ticks produce the same head", () => {
        const bars = dayAnchoredBars([100, 110, 120], [10, 20, 30]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => vwap("slot"));
        const tickBar: Bar = { ...bars[bars.length - 1], close: 135, high: 135, low: 135 };
        let a = 0;
        let b = 0;
        tick(ctxRef, tickBar, () => {
            a = vwap("slot").current;
            return a;
        });
        tick(ctxRef, tickBar, () => {
            b = vwap("slot").current;
            return b;
        });
        expect(b).toBeCloseTo(a, 12);
    });

    it("tick on a bar that is itself the first bar of a new session emits the session-reset value", () => {
        // Bar 1 is the first bar of day B (it crossed the boundary at
        // close-time). After bar 1's close, the cum reflects day B only.
        // A tick on bar 1 (still day B) recomputes from prev-close's
        // day-A snapshot, sees the dayKey transition, resets to 0 + the
        // new contribution.
        const dayA = Math.floor(1_700_000_000_000 / MS_PER_DAY) * MS_PER_DAY;
        const dayB = dayA + MS_PER_DAY;
        const bars: Bar[] = [
            {
                time: dayA,
                open: 100,
                high: 100,
                low: 100,
                close: 100,
                volume: 10,
                symbol: "T",
                interval: "1m",
            },
            // Bar 1 starts at dayB — already a session reset on close.
            {
                time: dayB,
                open: 200,
                high: 200,
                low: 200,
                close: 200,
                volume: 10,
                symbol: "T",
                interval: "1m",
            },
        ];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => vwap("slot"));
        // Tick at the same bar time (dayB) — the prev-close snapshot is
        // bar 0's day-A state (cumPV=1000, cumV=10, dayKey=day-A); the
        // tick's dayKey is day-B → fold resets.
        const tickBar: Bar = { ...bars[1], close: 250, high: 250, low: 250 };
        const head = tick(ctxRef, tickBar, () => vwap("slot").current);
        // Reset → vwap = (250 * 10) / 10 = 250.
        expect(head).toBeCloseTo(250, 12);
    });
});
