// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { aroon } from "./aroon";
import { aroonOsc } from "./aroonOsc";
import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";

function constantBar(h: number, l: number, i: number): Bar {
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open: (h + l) / 2,
        high: h,
        low: l,
        close: (h + l) / 2,
        volume: 0,
        symbol: "T",
        interval: "1m",
    };
}

describe("ta.aroonOsc", () => {
    it("equals aroon.up - aroon.down at every bar", () => {
        const bars = syntheticBars(40, 19);
        const expected = harness(bars, bars.length + 1, () => {
            const r = aroon("slot", 5);
            return Number.isFinite(r.up.current) && Number.isFinite(r.down.current)
                ? r.up.current - r.down.current
                : Number.NaN;
        });
        const actual = harness(bars, bars.length + 1, () => aroonOsc("slot", 5).current);
        for (let i = 0; i < bars.length; i += 1) {
            if (Number.isNaN(expected[i])) expect(Number.isNaN(actual[i])).toBe(true);
            else expect(actual[i]).toBeCloseTo(expected[i], 12);
        }
    });

    it("emits NaN until `length` closed bars have been folded in", () => {
        const bars = syntheticBars(20, 3);
        const out = harness(bars, bars.length + 1, () => aroonOsc("slot", 5).current);
        for (let i = 0; i < 5; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
        expect(Number.isFinite(out[5])).toBe(true);
    });

    it("returns 100 when only the head is the high AND the oldest is the low", () => {
        // Highs strictly ascending → up = 100. Lows strictly ascending →
        // min is the oldest → down = 0. Osc = 100.
        const bars = [1, 2, 3, 4, 5, 6].map((v, i) => constantBar(v, v, i));
        const out = harness(bars, bars.length + 1, () => aroonOsc("slot", 5).current);
        expect(out[5]).toBe(100);
    });

    it("returns -100 when only the head is the low AND the oldest is the high", () => {
        // Highs strictly descending → max is the oldest → up = 0.
        // Lows strictly descending → min is the head → down = 100. Osc = -100.
        const bars = [6, 5, 4, 3, 2, 1].map((v, i) => constantBar(v, v, i));
        const out = harness(bars, bars.length + 1, () => aroonOsc("slot", 5).current);
        expect(out[5]).toBe(-100);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 5);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            ids.add(aroonOsc("slot", 5));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => aroonOsc("oops", 5)).toThrowError(
            /ta.aroonOsc called outside an active script step/,
        );
    });

    it("NaN propagation: NaN window → NaN output", () => {
        const bars = [Number.NaN, Number.NaN, Number.NaN, Number.NaN, Number.NaN, Number.NaN].map(
            (v, i) => constantBar(v, v, i),
        );
        const out = harness(bars, bars.length + 1, () => aroonOsc("slot", 5).current);
        expect(Number.isNaN(out[5])).toBe(true);
    });
});

describe("ta.aroonOsc tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(15, 11);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => aroonOsc("slot", 5));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, high: last.high + 100, low: last.low - 100 }, () =>
            aroonOsc("slot", 5),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(15, 17);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => aroonOsc("slot", 5));
        const last = bars[bars.length - 1];
        const tickBar = { ...last, high: last.high + 3, low: last.low - 3 };
        const a = tick(ctxRef, tickBar, () => aroonOsc("slot", 5).current);
        const b = tick(ctxRef, tickBar, () => aroonOsc("slot", 5).current);
        expect(b).toBe(a);
    });
});
