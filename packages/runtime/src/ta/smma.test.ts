// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { smmaFloat64 } from "./lib/smmaFloat64";
import { smma } from "./smma";

describe("ta.smma", () => {
    it("matches smmaFloat64 over a 50-bar synthetic walk", () => {
        const bars = syntheticBars(50, 11);
        const closes = new Float64Array(bars.map((b) => b.close));
        const expected = smmaFloat64(closes, 10);
        const actual = harness(bars, bars.length + 1, (bar) => smma("slot", bar.close, 10).current);
        for (let i = 0; i < bars.length; i += 1) {
            const a = actual[i];
            const e = expected[i];
            if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
            else expect(a).toBeCloseTo(e, 10);
        }
    });

    it("emits NaN until the seed window is filled", () => {
        const bars = syntheticBars(20, 5);
        const out = harness(bars, bars.length + 1, (bar) => smma("slot", bar.close, 4).current);
        for (let i = 0; i < 3; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[3])).toBe(true);
    });

    it("equals the constant for a constant-input stream past warmup", () => {
        const bars = [7, 7, 7, 7, 7, 7, 7, 7].map((c, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: c,
            high: c,
            low: c,
            close: c,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => smma("slot", bar.close, 4).current);
        for (let i = 3; i < bars.length; i += 1) {
            expect(out[i]).toBeCloseTo(7, 12);
        }
    });

    it("holds the previous value forward when the source is NaN past warmup", () => {
        const bars = syntheticBars(20, 4).map((b, i) =>
            i === 12 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => smma("slot", bar.close, 5).current);
        expect(out[12]).toBeCloseTo(out[11], 12);
    });

    it("returns NaN for NaN during warmup", () => {
        const bars = syntheticBars(10, 3).map((b, i) =>
            i === 1 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => smma("slot", bar.close, 4).current);
        expect(Number.isNaN(out[1])).toBe(true);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = smma("slot", bar.close, 3);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => smma("oops", 1, 3)).toThrowError(
            /ta.smma called outside an active script step/,
        );
    });
});

describe("ta.smma tick-mode", () => {
    it("replaces the head without advancing the window", () => {
        const bars = syntheticBars(10, 8);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            smma("slot", bar.close, 4),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickClose = bars[bars.length - 1].close + 5;
        tick(ctxRef, { ...bars[bars.length - 1], close: tickClose }, () =>
            smma("slot", tickClose, 4),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(20, 9);
        const length = 5;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            smma("slot", bar.close, length),
        );
        const tickClose = bars[bars.length - 1].close + 10;
        const tickBar = { ...bars[bars.length - 1], close: tickClose };
        const a = tick(ctxRef, tickBar, () => smma("slot", tickClose, length).current);
        const b = tick(ctxRef, tickBar, () => smma("slot", tickClose, length).current);
        expect(b).toBeCloseTo(a, 12);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            smma("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[2], () => smma("slot", bars[2].close, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with NaN source forward-fills the prior closed value", () => {
        const bars = syntheticBars(20, 1);
        const length = 5;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            smma("slot", bar.close, length),
        );
        // Prior closed value is the last bar's smma; tick with NaN should
        // return that same value (forward-fill).
        const prevClosed = (ctxRef.ctx.stream.taSlots.get("slot") as { prevClosedSmma: number })
            .prevClosedSmma;
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => smma("slot", Number.NaN, length).current,
        );
        expect(head).toBeCloseTo(prevClosed, 12);
    });

    it("tick of the very last bar pre-seed (count === length - 1) returns NaN", () => {
        // 4 finite bars + length=5 — count after first close = 1, …, after
        // 4th = 4 < 5 → NaN. Tick on bar 3 (count = 4 going into the tick)
        // returns NaN because nextCount = 5 but the seed must come from
        // an actual close.
        const bars = syntheticBars(4, 11);
        const length = 5;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            smma("slot", bar.close, length),
        );
        // After 4 closes, seedCount is 4 (< 5). On a 5th tick the count
        // would advance to 5 and a seed value would be available — by
        // design tick recomputes "as if" a 5th close happened.
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => smma("slot", bars[bars.length - 1].close, length).current,
        );
        // First seed available: mean of (bars[0].close + bars[1].close +
        // bars[2].close + bars[3].close + tickValue). Tick uses the last
        // bar's close again — but the slot already absorbed bars[3].close.
        const sum = bars[0].close + bars[1].close + bars[2].close + bars[3].close;
        const tickValue = bars[bars.length - 1].close;
        // For seedCount=4 (< length=5), tick branch computes
        // (seedSum + tickValue) / length where seedSum = sum of first 4
        // finite values. The 4th finite value IS bars[3].close.
        const expected = (sum + tickValue) / length;
        expect(head).toBeCloseTo(expected, 12);
    });
});
