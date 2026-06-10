// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { donchian } from "./donchian.js";

function bar(h: number, l: number, i: number): Bar {
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

describe("ta.donchian", () => {
    it("emits NaN at all outputs until warmup completes (length - 1 bars)", () => {
        const bars = syntheticBars(10, 3);
        const out = harness(bars, bars.length + 1, () => {
            const d = donchian("slot", 5);
            return { u: d.upper.current, m: d.middle.current, l: d.lower.current };
        });
        for (let i = 0; i < 4; i += 1) {
            expect(Number.isNaN(out[i].u)).toBe(true);
            expect(Number.isNaN(out[i].m)).toBe(true);
            expect(Number.isNaN(out[i].l)).toBe(true);
        }
        expect(Number.isFinite(out[4].u)).toBe(true);
        expect(Number.isFinite(out[4].m)).toBe(true);
        expect(Number.isFinite(out[4].l)).toBe(true);
    });

    it("upper = max(high), lower = min(low), middle = (upper + lower) / 2", () => {
        // Highs: 2, 5, 3, 4, 6. Lows: 1, 1, 2, 1, 3. After 5 bars (length=5):
        //   upper = 6, lower = 1, middle = 3.5.
        const highs = [2, 5, 3, 4, 6];
        const lows = [1, 1, 2, 1, 3];
        const bars = highs.map((h, i) => bar(h, lows[i], i));
        const out = harness(bars, bars.length + 1, () => {
            const d = donchian("slot", 5);
            return { u: d.upper.current, m: d.middle.current, l: d.lower.current };
        });
        expect(out[4].u).toBe(6);
        expect(out[4].l).toBe(1);
        expect(out[4].m).toBe(3.5);
    });

    it("returns the same DonchianResult identity on every call", () => {
        const bars = syntheticBars(10, 9);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            ids.add(donchian("slot", 5));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => donchian("oops", 5)).toThrowError(
            /ta.donchian called outside an active script step/,
        );
    });

    it("all-NaN window → NaN at all outputs", () => {
        const bars = [Number.NaN, Number.NaN, Number.NaN, Number.NaN, Number.NaN].map((h, i) =>
            bar(h, h, i),
        );
        const out = harness(bars, bars.length + 1, () => {
            const d = donchian("slot", 5);
            return { u: d.upper.current, m: d.middle.current, l: d.lower.current };
        });
        expect(Number.isNaN(out[4].u)).toBe(true);
        expect(Number.isNaN(out[4].m)).toBe(true);
        expect(Number.isNaN(out[4].l)).toBe(true);
    });

    it("one-bar NaN with finite trailing returns finite outputs from the trailing window", () => {
        const highs = [1, 2, 3, 4, 5, Number.NaN];
        const lows = [1, 2, 3, 4, 5, Number.NaN];
        const bars = highs.map((h, i) => bar(h, lows[i], i));
        const out = harness(bars, bars.length + 1, () => {
            const d = donchian("slot", 5);
            return { u: d.upper.current, m: d.middle.current, l: d.lower.current };
        });
        // After bar 5 the window is bars 1..5; NaN at slot 5 is skipped.
        // upper = max(2,3,4,5) = 5; lower = min(2,3,4,5) = 2.
        expect(out[5].u).toBe(5);
        expect(out[5].l).toBe(2);
        expect(out[5].m).toBe(3.5);
    });
});

describe("ta.donchian tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(15, 17);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => donchian("slot", 5));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, high: last.high + 100, low: last.low - 100 }, () =>
            donchian("slot", 5),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("a tick high beyond any closed value lifts the upper band", () => {
        const bars = [1, 2, 3, 4, 5].map((h, i) => bar(h, h - 0.5, i));
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => donchian("slot", 5));
        const last = bars[bars.length - 1];
        const head = tick(ctxRef, { ...last, high: 9999, low: last.low }, () => {
            const d = donchian("slot", 5);
            return { u: d.upper.current, m: d.middle.current };
        });
        expect(head.u).toBe(9999);
    });

    it("two identical ticks produce the same heads", () => {
        const bars = syntheticBars(15, 21);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => donchian("slot", 5));
        const last = bars[bars.length - 1];
        const tickBar = { ...last, high: last.high + 5, low: last.low - 5 };
        const a = tick(ctxRef, tickBar, () => {
            const d = donchian("slot", 5);
            return { u: d.upper.current, m: d.middle.current, l: d.lower.current };
        });
        const b = tick(ctxRef, tickBar, () => {
            const d = donchian("slot", 5);
            return { u: d.upper.current, m: d.middle.current, l: d.lower.current };
        });
        expect(b.u).toBe(a.u);
        expect(b.m).toBe(a.m);
        expect(b.l).toBe(a.l);
    });
});
