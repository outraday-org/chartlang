// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { cci } from "./cci.js";

const SCALING = 0.015;

function referenceCci(tp: ReadonlyArray<number>, length: number): number[] {
    const out: number[] = new Array(tp.length).fill(Number.NaN);
    if (tp.length < length) return out;
    for (let i = length - 1; i < tp.length; i += 1) {
        let sum = 0;
        for (let j = i - length + 1; j <= i; j += 1) sum += tp[j];
        const mean = sum / length;
        let absDev = 0;
        for (let j = i - length + 1; j <= i; j += 1) {
            const d = tp[j] - mean;
            absDev += d < 0 ? -d : d;
        }
        const md = absDev / length;
        out[i] = md === 0 ? Number.NaN : (tp[i] - mean) / (SCALING * md);
    }
    return out;
}

describe("ta.cci", () => {
    it("matches reference CCI on a 50-bar synthetic walk over hlc3", () => {
        const bars = syntheticBars(50, 11);
        const tp = bars.map((b) => (b.high + b.low + b.close) / 3);
        const expected = referenceCci(tp, 10);
        const actual = harness(
            bars,
            bars.length + 1,
            (bar) => cci("slot", (bar.high + bar.low + bar.close) / 3, 10).current,
        );
        for (let i = 0; i < bars.length; i += 1) {
            if (Number.isNaN(expected[i])) {
                expect(Number.isNaN(actual[i])).toBe(true);
            } else {
                expect(actual[i]).toBeCloseTo(expected[i], 10);
            }
        }
    });

    it("emits NaN until the window is filled", () => {
        const bars = syntheticBars(20, 5);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => cci("slot", (bar.high + bar.low + bar.close) / 3, 5).current,
        );
        for (let i = 0; i < 4; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[4])).toBe(true);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = cci("slot", (bar.high + bar.low + bar.close) / 3, 3);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => cci("oops", 1, 3)).toThrowError(/ta.cci called outside an active script step/);
    });

    it("emits NaN on a flat-line window (meanDev = 0)", () => {
        const bars = Array.from({ length: 10 }, (_, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: 100,
            high: 100,
            low: 100,
            close: 100,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => cci("slot", bar.close, 5).current);
        // Every bar past warmup should be NaN because the window is flat.
        for (let i = 4; i < bars.length; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
    });

    it("holds prior CCI across a NaN source past warmup", () => {
        const bars = syntheticBars(20, 4).map((b, i) =>
            i === 12 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => cci("slot", bar.close, 5).current);
        expect(out[12]).toBeCloseTo(out[11], 10);
    });

    it("returns NaN for NaN source during warmup", () => {
        const bars = syntheticBars(10, 3).map((b, i) =>
            i === 1 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => cci("slot", bar.close, 4).current);
        expect(Number.isNaN(out[1])).toBe(true);
    });

    it("accepts opts (offset, lineStyle) without throwing", () => {
        const bars = syntheticBars(20, 6);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) =>
                cci("slot", (bar.high + bar.low + bar.close) / 3, 5, {
                    offset: 0,
                    lineStyle: "line",
                }).current,
        );
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });
});

describe("ta.cci tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(20, 7);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            cci("slot", (bar.high + bar.low + bar.close) / 3, 5),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickClose = bars[bars.length - 1].close + 10;
        const tickHlc3 = (bars[bars.length - 1].high + bars[bars.length - 1].low + tickClose) / 3;
        tick(ctxRef, { ...bars[bars.length - 1], close: tickClose }, () =>
            cci("slot", tickHlc3, 5),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(20, 9);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            cci("slot", (bar.high + bar.low + bar.close) / 3, 5),
        );
        const tickClose = bars[bars.length - 1].close + 5;
        const tickBar = { ...bars[bars.length - 1], close: tickClose };
        const tickHlc3 = (tickBar.high + tickBar.low + tickClose) / 3;
        const a = tick(ctxRef, tickBar, () => cci("slot", tickHlc3, 5).current);
        const b = tick(ctxRef, tickBar, () => cci("slot", tickHlc3, 5).current);
        expect(b).toBeCloseTo(a, 12);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            cci("slot", (bar.high + bar.low + bar.close) / 3, 5),
        );
        const head = tick(
            ctxRef,
            bars[2],
            () => cci("slot", (bars[2].high + bars[2].low + bars[2].close) / 3, 5).current,
        );
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with NaN source returns a finite hold (post-warmup)", () => {
        const bars = syntheticBars(20, 1);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            cci("slot", (bar.high + bar.low + bar.close) / 3, 5),
        );
        const head = tick(ctxRef, bars[bars.length - 1], () => cci("slot", Number.NaN, 5).current);
        // NaN tick re-emits the prior closed CCI off the existing window.
        // For our synthetic walk, that's a finite number.
        expect(Number.isFinite(head)).toBe(true);
    });
});
