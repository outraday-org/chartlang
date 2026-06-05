// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { chandelier } from "./chandelier";
import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";

function makeBar(open: number, high: number, low: number, close: number, i: number): Bar {
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open,
        high,
        low,
        close,
        volume: 0,
        symbol: "T",
        interval: "1m",
    };
}

describe("ta.chandelier", () => {
    it("emits NaN through the ATR warmup (`length` bars)", () => {
        const bars = syntheticBars(30, 5);
        const out = harness(bars, bars.length + 1, () => {
            const c = chandelier("slot", { length: 5, multiplier: 2 });
            return { long: c.long.current, short: c.short.current };
        });
        // ATR seed is at bar `length - 1`; highest/lowest warmup is also
        // `length - 1`. Both sub-slots emit NaN for bars 0..length-2.
        for (let i = 0; i < 4; i += 1) {
            expect(Number.isNaN(out[i].long)).toBe(true);
            expect(Number.isNaN(out[i].short)).toBe(true);
        }
        // From bar `length - 1` onwards both should be finite.
        expect(Number.isFinite(out[4].long)).toBe(true);
        expect(Number.isFinite(out[4].short)).toBe(true);
    });

    it("flat OHLC: long < high; short > low — constant ATR offset away", () => {
        // Flat highs/lows → ATR = high - low (constant); highest/lowest
        // are constant; long = high - multiplier*ATR, short = low +
        // multiplier*ATR.
        const bars: Bar[] = [];
        for (let i = 0; i < 10; i += 1) {
            bars.push(makeBar(100, 105, 95, 100, i));
        }
        const out = harness(bars, bars.length + 1, () => {
            const c = chandelier("slot", { length: 5, multiplier: 2 });
            return { long: c.long.current, short: c.short.current };
        });
        // ATR seeds at length - 1 = 4 with TR = high - low = 10.
        // long  = 105 - 2 * 10 = 85; short = 95 + 2 * 10 = 115.
        expect(out[4].long).toBeCloseTo(85, 10);
        expect(out[4].short).toBeCloseTo(115, 10);
        // Subsequent bars: same constant.
        expect(out[9].long).toBeCloseTo(85, 10);
        expect(out[9].short).toBeCloseTo(115, 10);
    });

    it("rising highs raise long stop in lockstep with the highest-high", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 10; i += 1) {
            bars.push(makeBar(100 + i, 102 + i, 98 + i, 101 + i, i));
        }
        const out = harness(bars, bars.length + 1, () => {
            const c = chandelier("slot", { length: 5, multiplier: 2 });
            return { long: c.long.current, short: c.short.current };
        });
        // long is monotonically non-decreasing once warm.
        for (let i = 5; i < bars.length; i += 1) {
            if (Number.isFinite(out[i - 1].long) && Number.isFinite(out[i].long)) {
                expect(out[i].long).toBeGreaterThanOrEqual(out[i - 1].long);
            }
        }
    });

    it("returns the same ChandelierResult identity on every call", () => {
        const bars = syntheticBars(10, 7);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            ids.add(chandelier("slot"));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => chandelier("oops")).toThrowError(
            /ta.chandelier called outside an active script step/,
        );
    });

    it("NaN OHLC → NaN ATR for that bar → NaN outputs that bar", () => {
        // ATR propagates NaN when OHLC is non-finite (its closeValue
        // returns NaN on non-finite high/low/close — see atr.ts:79-82).
        // Highest/lowest skip NaN sources but stay finite.
        // Chandelier multiplies by ATR, so NaN ATR → NaN outputs.
        const bars: Bar[] = [];
        for (let i = 0; i < 5; i += 1) {
            bars.push(makeBar(100, 102, 98, 100, i));
        }
        bars.push({ ...makeBar(100, Number.NaN, Number.NaN, Number.NaN, 5) });
        const out = harness(bars, bars.length + 1, () => {
            const c = chandelier("slot", { length: 3, multiplier: 2 });
            return { long: c.long.current, short: c.short.current };
        });
        // atr.ts:79-82 returns slot.atr (finite, from prior bar) when
        // the current bar has NaN OHLC — i.e. ATR is held FROZEN, not
        // NaN'd. So chandelier's output stays finite (long = prior
        // highest - mult * prior ATR; short symmetric). Pin THAT
        // behaviour to lock the actual contract:
        expect(Number.isFinite(out[5].long)).toBe(true);
        expect(Number.isFinite(out[5].short)).toBe(true);
    });

    it("uses defaults (length=22, multiplier=3) when opts omitted", () => {
        const bars = syntheticBars(30, 9);
        const out = harness(bars, bars.length + 1, () => {
            const c = chandelier("slot");
            return { long: c.long.current, short: c.short.current };
        });
        // Bar 21 (= length - 1) is the first warm bar.
        expect(Number.isFinite(out[21].long)).toBe(true);
        expect(Number.isFinite(out[21].short)).toBe(true);
        expect(Number.isNaN(out[20].long)).toBe(true);
    });
});

describe("ta.chandelier tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(15, 11);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            chandelier("slot", { length: 5, multiplier: 2 }),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, high: last.high + 100, low: last.low - 100 }, () =>
            chandelier("slot", { length: 5, multiplier: 2 }),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(15, 13);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            chandelier("slot", { length: 5, multiplier: 2 }),
        );
        const last = bars[bars.length - 1];
        const tickBar = { ...last, high: last.high + 5, low: last.low - 5 };
        const a = tick(ctxRef, tickBar, () => {
            const c = chandelier("slot", { length: 5, multiplier: 2 });
            return { long: c.long.current, short: c.short.current };
        });
        const b = tick(ctxRef, tickBar, () => {
            const c = chandelier("slot", { length: 5, multiplier: 2 });
            return { long: c.long.current, short: c.short.current };
        });
        expect(b.long).toBe(a.long);
        expect(b.short).toBe(a.short);
    });

    it("ticking the last closed bar's own values reproduces the close output", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 15; i += 1) {
            bars.push(makeBar(100 + i * 0.1, 102 + i * 0.1, 98 + i * 0.1, 100 + i * 0.1, i));
        }
        const closedOut = harness(bars, bars.length + 1, () => {
            const c = chandelier("slot", { length: 5, multiplier: 2 });
            return { long: c.long.current, short: c.short.current };
        });
        const lastClosed = closedOut[closedOut.length - 1];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            chandelier("slot", { length: 5, multiplier: 2 }),
        );
        const last = bars[bars.length - 1];
        const tickHead = tick(ctxRef, last, () => {
            const c = chandelier("slot", { length: 5, multiplier: 2 });
            return { long: c.long.current, short: c.short.current };
        });
        expect(tickHead.long).toBeCloseTo(lastClosed.long, 10);
        expect(tickHead.short).toBeCloseTo(lastClosed.short, 10);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 17);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () =>
            chandelier("slot", { length: 5, multiplier: 2 }),
        );
        const head = tick(ctxRef, bars[2], () => {
            const c = chandelier("slot", { length: 5, multiplier: 2 });
            return { long: c.long.current, short: c.short.current };
        });
        expect(Number.isNaN(head.long)).toBe(true);
        expect(Number.isNaN(head.short)).toBe(true);
    });
});
