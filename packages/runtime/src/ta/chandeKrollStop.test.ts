// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { chandeKrollStop } from "./chandeKrollStop.js";
import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";

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

describe("ta.chandeKrollStop", () => {
    it("emits NaN through `length + smoothingLength - 1` bars warmup", () => {
        const bars = syntheticBars(40, 5);
        const length = 5;
        const smoothingLength = 4;
        const out = harness(bars, bars.length + 1, () => {
            const c = chandeKrollStop("slot", { length, multiplier: 1, smoothingLength });
            return { long: c.long.current, short: c.short.current };
        });
        // First warm bar: length + smoothingLength - 1 = 8 (0-based).
        for (let i = 0; i < 7; i += 1) {
            expect(Number.isNaN(out[i].long)).toBe(true);
            expect(Number.isNaN(out[i].short)).toBe(true);
        }
        expect(Number.isFinite(out[7].long)).toBe(true);
        expect(Number.isFinite(out[7].short)).toBe(true);
    });

    it("flat OHLC: long = first-pass long (constant); short symmetric", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 20; i += 1) {
            bars.push(makeBar(100, 105, 95, 100, i));
        }
        const out = harness(bars, bars.length + 1, () => {
            const c = chandeKrollStop("slot", {
                length: 3,
                multiplier: 1,
                smoothingLength: 3,
            });
            return { long: c.long.current, short: c.short.current };
        });
        // ATR = high - low = 10 (constant). firstHigh = 105 - 1*10 = 95.
        // firstLow = 95 + 1*10 = 105. Second pass: max(95) = 95;
        // min(105) = 105. Warmup ends at length + smoothingLength - 1 = 5.
        expect(out[5].long).toBeCloseTo(95, 10);
        expect(out[5].short).toBeCloseTo(105, 10);
    });

    it("returns the same result identity on every call", () => {
        const bars = syntheticBars(20, 7);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            ids.add(chandeKrollStop("slot"));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => chandeKrollStop("oops")).toThrowError(
            /ta.chandeKrollStop called outside an active script step/,
        );
    });

    it("NaN high → NaN first-pass propagates to second-pass for that bar", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 10; i += 1) bars.push(makeBar(100, 102, 98, 100, i));
        bars.push({ ...makeBar(100, Number.NaN, Number.NaN, Number.NaN, 10) });
        const out = harness(bars, bars.length + 1, () => {
            const c = chandeKrollStop("slot", {
                length: 3,
                multiplier: 1,
                smoothingLength: 3,
            });
            return { long: c.long.current, short: c.short.current };
        });
        // NaN bar's first-pass is NaN. Second pass over the
        // smoothingLength window includes finite siblings → still finite.
        expect(Number.isFinite(out[10].long)).toBe(true);
        expect(Number.isFinite(out[10].short)).toBe(true);
    });

    it("uses defaults (length=10, multiplier=1, smoothingLength=9) when opts omitted", () => {
        const bars = syntheticBars(40, 9);
        const out = harness(bars, bars.length + 1, () => {
            const c = chandeKrollStop("slot");
            return { long: c.long.current, short: c.short.current };
        });
        // First warm bar at barCount >= length + smoothingLength - 1
        // = 18 (1-based count) → bar index 17 (0-based).
        expect(Number.isFinite(out[17].long)).toBe(true);
        expect(Number.isNaN(out[16].long)).toBe(true);
    });

    it("sharp reversal: second-pass smoothing carries prior extremes forward", () => {
        // Build a uptrend then a sharp drop. The second-pass long
        // (max of firstHigh) should NOT immediately drop on the
        // reversal — it carries the prior-bar high stops within
        // the smoothing window.
        const bars: Bar[] = [];
        for (let i = 0; i < 15; i += 1) {
            bars.push(makeBar(100 + i, 102 + i, 98 + i, 101 + i, i));
        }
        // Sharp drop — bar 15's low is well below prior.
        bars.push(makeBar(115, 116, 50, 50, 15));
        const out = harness(bars, bars.length + 1, () => {
            const c = chandeKrollStop("slot", {
                length: 5,
                multiplier: 1,
                smoothingLength: 5,
            });
            return c.long.current;
        });
        // The reversal bar's long should still be ≥ the bar before
        // (smoothing window pulls in the prior bar's firstHigh).
        expect(out[15]).toBeGreaterThanOrEqual(out[14] - 1e-9);
    });
});

describe("ta.chandeKrollStop tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(20, 11);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            chandeKrollStop("slot", { length: 5, multiplier: 1, smoothingLength: 5 }),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, high: last.high + 50 }, () =>
            chandeKrollStop("slot", { length: 5, multiplier: 1, smoothingLength: 5 }),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(20, 13);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            chandeKrollStop("slot", { length: 5, multiplier: 1, smoothingLength: 5 }),
        );
        const last = bars[bars.length - 1];
        const tickBar = { ...last, high: last.high + 5, low: last.low - 5 };
        const a = tick(ctxRef, tickBar, () => {
            const c = chandeKrollStop("slot", { length: 5, multiplier: 1, smoothingLength: 5 });
            return { long: c.long.current, short: c.short.current };
        });
        const b = tick(ctxRef, tickBar, () => {
            const c = chandeKrollStop("slot", { length: 5, multiplier: 1, smoothingLength: 5 });
            return { long: c.long.current, short: c.short.current };
        });
        expect(b.long).toBe(a.long);
        expect(b.short).toBe(a.short);
    });

    it("ticking the last closed bar's own values reproduces the close output", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 20; i += 1) {
            bars.push(makeBar(100 + i * 0.1, 102 + i * 0.1, 98 + i * 0.1, 100 + i * 0.1, i));
        }
        const closedOut = harness(bars, bars.length + 1, () => {
            const c = chandeKrollStop("slot", { length: 5, multiplier: 1, smoothingLength: 5 });
            return { long: c.long.current, short: c.short.current };
        });
        const lastClosed = closedOut[closedOut.length - 1];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            chandeKrollStop("slot", { length: 5, multiplier: 1, smoothingLength: 5 }),
        );
        const last = bars[bars.length - 1];
        const tickHead = tick(ctxRef, last, () => {
            const c = chandeKrollStop("slot", { length: 5, multiplier: 1, smoothingLength: 5 });
            return { long: c.long.current, short: c.short.current };
        });
        expect(tickHead.long).toBeCloseTo(lastClosed.long, 10);
        expect(tickHead.short).toBeCloseTo(lastClosed.short, 10);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 17);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () =>
            chandeKrollStop("slot", { length: 5, multiplier: 1, smoothingLength: 5 }),
        );
        const head = tick(ctxRef, bars[2], () => {
            const c = chandeKrollStop("slot", { length: 5, multiplier: 1, smoothingLength: 5 });
            return { long: c.long.current, short: c.short.current };
        });
        expect(Number.isNaN(head.long)).toBe(true);
        expect(Number.isNaN(head.short)).toBe(true);
    });
});
