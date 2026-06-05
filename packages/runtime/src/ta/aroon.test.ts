// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { aroon } from "./aroon";
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

describe("ta.aroon", () => {
    it("emits NaN until `length` closed bars have been folded in", () => {
        const bars = syntheticBars(20, 3);
        const out = harness(bars, bars.length + 1, () => {
            const r = aroon("slot", 5);
            return { up: r.up.current, down: r.down.current };
        });
        // Warmup is `length`: first 5 outputs NaN, finite from bar index 5.
        for (let i = 0; i < 5; i += 1) {
            expect(Number.isNaN(out[i].up)).toBe(true);
            expect(Number.isNaN(out[i].down)).toBe(true);
        }
        expect(Number.isFinite(out[5].up)).toBe(true);
        expect(Number.isFinite(out[5].down)).toBe(true);
    });

    it("emits 100 on the bar that sets a new N-bar high", () => {
        // Strictly ascending highs → every closed bar IS the high →
        // barsSinceHigh = 0 → up = 100.
        const bars = [1, 2, 3, 4, 5, 6, 7].map((h, i) => constantBar(h, h - 1, i));
        const out = harness(bars, bars.length + 1, () => {
            const r = aroon("slot", 5);
            return r.up.current;
        });
        // From bar 5 onward, `up` should be 100 every bar (each new bar is the
        // new high). Lows are also strictly increasing → down should be
        // 100 * (5 - 5) / 5 = 0.
        expect(out[5]).toBe(100);
        expect(out[6]).toBe(100);
    });

    it("emits 0 / 100 when the extreme is the oldest bar in the window", () => {
        // Highs: 10, 1, 2, 3, 4, 5. After 6 bars closed with length=5, the
        // window is the last 6 highs; max is 10 at age 5 (oldest).
        // → barsSinceHigh = 5 → up = 100 * (5 - 5) / 5 = 0.
        // Lows: 1, 2, 3, 4, 5, 6 → min is 1 at age 5 → down = 0 too.
        const highs = [10, 1, 2, 3, 4, 5];
        const lows = [1, 2, 3, 4, 5, 6];
        const bars = highs.map((h, i) => constantBar(h, lows[i], i));
        const out = harness(bars, bars.length + 1, () => {
            const r = aroon("slot", 5);
            return { up: r.up.current, down: r.down.current };
        });
        expect(out[5].up).toBe(0);
        expect(out[5].down).toBe(0);
    });

    it("tie-break: smallest age wins (most-recent extreme)", () => {
        // Highs: 5, 5, 5, 5, 5, 5. With length=5, all highs equal. The
        // tie-break (smallest age) puts barsSinceHigh = 0 → up = 100.
        const bars = [5, 5, 5, 5, 5, 5].map((h, i) => constantBar(h, h - 1, i));
        const out = harness(bars, bars.length + 1, () => {
            const r = aroon("slot", 5);
            return r.up.current;
        });
        expect(out[5]).toBe(100);
    });

    it("returns the same AroonResult identity on every call", () => {
        const bars = syntheticBars(10, 7);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            ids.add(aroon("slot", 5));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => aroon("oops", 5)).toThrowError(
            /ta.aroon called outside an active script step/,
        );
    });

    it("NaN high → NaN up when the rest of the window is also NaN", () => {
        const bars = [Number.NaN, Number.NaN, Number.NaN, Number.NaN, Number.NaN, Number.NaN].map(
            (h, i) => constantBar(h, h, i),
        );
        const out = harness(bars, bars.length + 1, () => {
            const r = aroon("slot", 5);
            return { up: r.up.current, down: r.down.current };
        });
        expect(Number.isNaN(out[5].up)).toBe(true);
        expect(Number.isNaN(out[5].down)).toBe(true);
    });

    it("NaN head high → falls back to the most recent finite high in the window", () => {
        // Highs: 1, 2, 3, 4, 5, NaN. Length=5. The argmax over the window
        // (skipping NaN) is the bar at age 1 (high = 5) →
        // barsSinceHigh = 1 → up = 100 * (5 - 1) / 5 = 80.
        const highs = [1, 2, 3, 4, 5, Number.NaN];
        const lows = [1, 2, 3, 4, 5, 6];
        const bars = highs.map((h, i) => constantBar(h, lows[i], i));
        const out = harness(bars, bars.length + 1, () => {
            const r = aroon("slot", 5);
            return r.up.current;
        });
        expect(out[5]).toBeCloseTo(80, 12);
    });
});

describe("ta.aroon tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(15, 11);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => aroon("slot", 5));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, high: last.high + 100, low: last.low - 100 }, () =>
            aroon("slot", 5),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("a tick high beyond any closed value sets barsSinceHigh = 0 → up = 100", () => {
        const bars = [1, 2, 3, 4, 5, 6].map((h, i) => constantBar(h, h - 1, i));
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => aroon("slot", 5));
        const last = bars[bars.length - 1];
        const head = tick(ctxRef, { ...last, high: 9999 }, () => aroon("slot", 5).up.current);
        expect(head).toBe(100);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(15, 13);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => aroon("slot", 5));
        const last = bars[bars.length - 1];
        const tickBar = { ...last, high: last.high + 5, low: last.low - 5 };
        const a = tick(ctxRef, tickBar, () => {
            const r = aroon("slot", 5);
            return { up: r.up.current, down: r.down.current };
        });
        const b = tick(ctxRef, tickBar, () => {
            const r = aroon("slot", 5);
            return { up: r.up.current, down: r.down.current };
        });
        expect(b.up).toBe(a.up);
        expect(b.down).toBe(a.down);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () => aroon("slot", 5));
        const head = tick(ctxRef, bars[2], () => aroon("slot", 5).up.current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with NaN head + all-NaN window returns NaN", () => {
        const bars = [Number.NaN, Number.NaN, Number.NaN, Number.NaN, Number.NaN, Number.NaN].map(
            (h, i) => constantBar(h, h, i),
        );
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => aroon("slot", 5));
        const last = bars[bars.length - 1];
        const head = tick(ctxRef, { ...last, high: Number.NaN, low: Number.NaN }, () => {
            const r = aroon("slot", 5);
            return { up: r.up.current, down: r.down.current };
        });
        expect(Number.isNaN(head.up)).toBe(true);
        expect(Number.isNaN(head.down)).toBe(true);
    });
});
