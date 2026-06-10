// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { trendStrengthIndex } from "./trendStrengthIndex.js";

function priceBar(i: number, close: number): Bar {
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open: close,
        high: close,
        low: close,
        close,
        volume: 0,
        symbol: "T",
        interval: "1m",
    };
}

describe("ta.trendStrengthIndex", () => {
    it("emits NaN through the `length - 1` warmup, finite at index `length - 1`", () => {
        const bars = syntheticBars(25, 3);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => trendStrengthIndex("slot", bar.close, 5).current,
        );
        for (let i = 0; i < 4; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
        expect(Number.isFinite(out[4])).toBe(true);
    });

    it("returns +1 on a strictly ascending source (perfect uptrend)", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 10; i += 1) bars.push(priceBar(i, 100 + i));
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => trendStrengthIndex("slot", bar.close, 5).current,
        );
        // At index 4 (first defined slot), the window is [100..104] —
        // strictly ascending. Pearson with index series should be +1.
        expect(out[4]).toBeCloseTo(1, 10);
        expect(out[9]).toBeCloseTo(1, 10);
    });

    it("returns -1 on a strictly descending source (perfect downtrend)", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 10; i += 1) bars.push(priceBar(i, 100 - i));
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => trendStrengthIndex("slot", bar.close, 5).current,
        );
        expect(out[4]).toBeCloseTo(-1, 10);
        expect(out[9]).toBeCloseTo(-1, 10);
    });

    it("returns NaN on a flat source (zero variance)", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 10; i += 1) bars.push(priceBar(i, 100));
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => trendStrengthIndex("slot", bar.close, 5).current,
        );
        for (let i = 4; i < out.length; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
    });

    it("clamps to [-1, 1] for all defined outputs", () => {
        const bars = syntheticBars(50, 7);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => trendStrengthIndex("slot", bar.close, 10).current,
        );
        for (const v of out) {
            if (Number.isFinite(v)) {
                expect(v).toBeGreaterThanOrEqual(-1);
                expect(v).toBeLessThanOrEqual(1);
            }
        }
    });

    it("NaN inside the window → NaN output", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 10; i += 1) bars.push(priceBar(i, 100 + i));
        bars[5] = priceBar(5, Number.NaN);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => trendStrengthIndex("slot", bar.close, 5).current,
        );
        // Window covering index 5 ([1..5], [2..6], [3..7], [4..8], [5..9])
        // should all be NaN.
        for (let i = 5; i < 10; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
    });

    it("throws when called outside an active script step", () => {
        expect(() => trendStrengthIndex("oops", 0, 20)).toThrowError(
            /ta.trendStrengthIndex called outside an active script step/,
        );
    });
});

describe("ta.trendStrengthIndex tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(20, 21);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            trendStrengthIndex("slot", bar.close, 5),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, close: last.close + 5 }, () =>
            trendStrengthIndex("slot", last.close + 5, 5),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(20, 23);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            trendStrengthIndex("slot", bar.close, 5),
        );
        const last = bars[bars.length - 1];
        const tickClose = last.close + 1;
        const a = tick(
            ctxRef,
            { ...last, close: tickClose },
            () => trendStrengthIndex("slot", tickClose, 5).current,
        );
        const b = tick(
            ctxRef,
            { ...last, close: tickClose },
            () => trendStrengthIndex("slot", tickClose, 5).current,
        );
        if (Number.isNaN(a)) expect(Number.isNaN(b)).toBe(true);
        else expect(b).toBe(a);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 31);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            trendStrengthIndex("slot", bar.close, 5),
        );
        const last = bars[bars.length - 1];
        const head = tick(ctxRef, last, () => trendStrengthIndex("slot", last.close, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("NaN tick value → NaN head", () => {
        const bars = syntheticBars(15, 41);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            trendStrengthIndex("slot", bar.close, 5),
        );
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => trendStrengthIndex("slot", Number.NaN, 5).current,
        );
        expect(Number.isNaN(head)).toBe(true);
    });
});

describe("ta.trendStrengthIndex opts.offset", () => {
    it("offset 0 returns the canonical series by identity", () => {
        const bars = syntheticBars(20, 51);
        const seen = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            seen.add(trendStrengthIndex("slot", bar.close, 5, { offset: 0 }));
            return null;
        });
        expect(seen.size).toBe(1);
    });

    it("non-zero offset returns a stable cached shifted view", () => {
        const bars = syntheticBars(20, 53);
        const refs: unknown[] = [];
        harness(bars, bars.length + 1, (bar) => {
            refs.push(trendStrengthIndex("slot", bar.close, 5, { offset: 2 }));
            return null;
        });
        for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
    });
});
