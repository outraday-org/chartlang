// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { anchoredVwap } from "./anchoredVwap";
import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";

function flatBars(prices: ReadonlyArray<number>, volumes: ReadonlyArray<number>): Bar[] {
    const t0 = 1_700_000_000_000;
    return prices.map((p, i) => ({
        time: t0 + i * 60_000,
        open: p,
        high: p,
        low: p,
        close: p,
        volume: volumes[i],
        symbol: "T",
        interval: "1m",
    }));
}

describe("ta.anchoredVwap", () => {
    it("emits NaN until the first bar with time >= anchorTime", () => {
        const bars = flatBars([100, 110, 120, 130], [10, 10, 10, 10]);
        const anchor = bars[2].time; // anchor at bar 2.
        const out = harness(bars, bars.length + 1, () => anchoredVwap("slot", anchor).current);
        expect(Number.isNaN(out[0])).toBe(true);
        expect(Number.isNaN(out[1])).toBe(true);
        // Bar 2: accumulates first contribution → 120.
        expect(out[2]).toBeCloseTo(120, 12);
        // Bar 3: cum = 120*10 + 130*10 = 2500; v = 20 → 125.
        expect(out[3]).toBeCloseTo((120 * 10 + 130 * 10) / 20, 12);
    });

    it("never resets across day boundaries (unlike ta.vwap)", () => {
        const t0 = 1_700_000_000_000;
        const dayLater = t0 + 86_400_000;
        const bars: Bar[] = [
            {
                time: t0,
                open: 100,
                high: 100,
                low: 100,
                close: 100,
                volume: 10,
                symbol: "T",
                interval: "1m",
            },
            {
                time: dayLater,
                open: 200,
                high: 200,
                low: 200,
                close: 200,
                volume: 10,
                symbol: "T",
                interval: "1m",
            },
            {
                time: dayLater + 60_000,
                open: 210,
                high: 210,
                low: 210,
                close: 210,
                volume: 10,
                symbol: "T",
                interval: "1m",
            },
        ];
        const out = harness(bars, bars.length + 1, () => anchoredVwap("slot", t0).current);
        expect(out[0]).toBeCloseTo(100, 12);
        // No reset — running cum spans the day boundary.
        expect(out[1]).toBeCloseTo((100 * 10 + 200 * 10) / 20, 12);
        expect(out[2]).toBeCloseTo((100 * 10 + 200 * 10 + 210 * 10) / 30, 12);
    });

    it("anchor is sticky — first call wins; later calls' anchorTime is ignored", () => {
        const bars = flatBars([100, 110, 120, 130], [10, 10, 10, 10]);
        const initialAnchor = bars[0].time;
        const out = harness(
            bars,
            bars.length + 1,
            (bar) =>
                // After bar 0 we pass a different anchor — should be ignored.
                anchoredVwap("slot", bar.time === bars[0].time ? initialAnchor : 9e15).current,
        );
        // Bar 0 starts accumulation; bars 1+ keep accumulating.
        expect(out[0]).toBeCloseTo(100, 12);
        expect(out[3]).toBeCloseTo((100 + 110 + 120 + 130) / 4, 12);
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
                open: 110,
                high: 110,
                low: 110,
                close: 110,
                volume: 0,
                symbol: "T",
                interval: "1m",
            },
            {
                time: 1_700_000_120_000,
                open: Number.NaN,
                high: Number.NaN,
                low: Number.NaN,
                close: Number.NaN,
                volume: 5,
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
        const anchor = bars[0].time;
        const out = harness(bars, bars.length + 1, () => anchoredVwap("slot", anchor).current);
        expect(out[0]).toBeCloseTo(100, 12);
        expect(out[1]).toBeCloseTo(100, 12); // volume 0 skipped → cum unchanged.
        expect(out[2]).toBeCloseTo(100, 12); // NaN source skipped.
        expect(out[3]).toBeCloseTo((100 * 10 + 130 * 10) / 20, 12);
    });

    it("honours every opts.source (close / hl2 / hlc3 / ohlc4 / hlcc4)", () => {
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
        const close = harness(
            bars,
            bars.length + 1,
            () => anchoredVwap("slot", bars[0].time, { source: "close" }).current,
        );
        const hl2 = harness(
            bars,
            bars.length + 1,
            () => anchoredVwap("slot", bars[0].time, { source: "hl2" }).current,
        );
        const hlc3 = harness(
            bars,
            bars.length + 1,
            () => anchoredVwap("slot", bars[0].time, { source: "hlc3" }).current,
        );
        const ohlc4 = harness(
            bars,
            bars.length + 1,
            () => anchoredVwap("slot", bars[0].time, { source: "ohlc4" }).current,
        );
        const hlcc4 = harness(
            bars,
            bars.length + 1,
            () => anchoredVwap("slot", bars[0].time, { source: "hlcc4" }).current,
        );
        expect(close[0]).toBeCloseTo(100, 12);
        expect(hl2[0]).toBeCloseTo((200 + 0) / 2, 12);
        expect(hlc3[0]).toBeCloseTo((200 + 0 + 100) / 3, 12);
        expect(ohlc4[0]).toBeCloseTo((50 + 200 + 0 + 100) / 4, 12);
        expect(hlcc4[0]).toBeCloseTo((200 + 0 + 100 + 100) / 4, 12);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 3);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            identities.add(anchoredVwap("slot", bars[0].time));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => anchoredVwap("oops", 0)).toThrowError(
            /ta.anchoredVwap called outside an active script step/,
        );
    });
});

describe("ta.anchoredVwap tick-mode", () => {
    it("replaces the head without polluting next close's accumulator", () => {
        const bars = flatBars([100, 110, 120], [10, 10, 10]);
        const anchor = bars[0].time;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            anchoredVwap("slot", anchor),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar: Bar = { ...bars[bars.length - 1], close: 130, high: 130, low: 130 };
        const head = tick(ctxRef, tickBar, () => anchoredVwap("slot", anchor).current);
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
        // Prev-close cum after bar 1: pv = 100*10 + 110*10 = 2100; v = 20.
        // Tick adds 130 * 10 = 1300 → vwap = (2100 + 1300) / 30 ≈ 113.333.
        expect(head).toBeCloseTo((100 * 10 + 110 * 10 + 130 * 10) / 30, 12);
    });

    it("two identical ticks produce the same head", () => {
        const bars = flatBars([100, 110, 120], [10, 10, 10]);
        const anchor = bars[0].time;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            anchoredVwap("slot", anchor),
        );
        const tickBar: Bar = { ...bars[bars.length - 1], close: 140, high: 140, low: 140 };
        let a = 0;
        let b = 0;
        tick(ctxRef, tickBar, () => {
            a = anchoredVwap("slot", anchor).current;
            return a;
        });
        tick(ctxRef, tickBar, () => {
            b = anchoredVwap("slot", anchor).current;
            return b;
        });
        expect(b).toBeCloseTo(a, 12);
    });

    it("tick on a bar before the anchor returns NaN", () => {
        const bars = flatBars([100], [10]);
        const anchor = bars[0].time + 1_000_000;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            anchoredVwap("slot", anchor),
        );
        const tickBar: Bar = { ...bars[0], close: 150 };
        const head = tick(ctxRef, tickBar, () => anchoredVwap("slot", anchor).current);
        expect(Number.isNaN(head)).toBe(true);
    });
});
