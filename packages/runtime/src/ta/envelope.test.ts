// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { envelope } from "./envelope";

function makeBar(c: number, i: number): Bar {
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open: c,
        high: c + 1,
        low: c - 1,
        close: c,
        volume: 0,
        symbol: "T",
        interval: "1m",
    };
}

describe("ta.envelope", () => {
    it("emits NaN at all outputs until warmup (length - 1 bars)", () => {
        const bars = syntheticBars(10, 5);
        const out = harness(bars, bars.length + 1, (b) => {
            const e = envelope("slot", b.close, { length: 5, percent: 10, maType: "sma" });
            return { u: e.upper.current, m: e.middle.current, l: e.lower.current };
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

    it("middle = SMA(close, 5); upper = middle * 1.1; lower = middle * 0.9", () => {
        const closes = [10, 12, 14, 16, 18];
        const bars = closes.map((c, i) => makeBar(c, i));
        const out = harness(bars, bars.length + 1, (b) => {
            const e = envelope("slot", b.close, { length: 5, percent: 10, maType: "sma" });
            return { u: e.upper.current, m: e.middle.current, l: e.lower.current };
        });
        // SMA(close, 5) at bar 4 = (10 + 12 + 14 + 16 + 18) / 5 = 14
        expect(out[4].m).toBeCloseTo(14, 10);
        expect(out[4].u).toBeCloseTo(14 * 1.1, 10);
        expect(out[4].l).toBeCloseTo(14 * 0.9, 10);
    });

    it("returns the same EnvelopeResult identity on every call", () => {
        const bars = syntheticBars(10, 13);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, (b) => {
            ids.add(envelope("slot", b.close, { length: 5 }));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("defaults to length=20, percent=10, maType=sma", () => {
        const bars = syntheticBars(25, 15);
        const out = harness(bars, bars.length + 1, (b) => {
            const e = envelope("slot", b.close);
            return { u: e.upper.current, m: e.middle.current, l: e.lower.current };
        });
        // SMA seeds at length-1 = 19; first defined output at bar 19.
        expect(Number.isFinite(out[19].m)).toBe(true);
        if (Number.isFinite(out[19].m)) {
            expect(out[19].u).toBeCloseTo(out[19].m * 1.1, 10);
            expect(out[19].l).toBeCloseTo(out[19].m * 0.9, 10);
        }
    });

    it("supports sma / ema / wma / smma maType dispatch", () => {
        const bars = syntheticBars(30, 17);
        for (const maType of ["sma", "ema", "wma", "smma"] as const) {
            const out = harness(bars, bars.length + 1, (b) => {
                const e = envelope(`slot-${maType}`, b.close, { length: 5, maType });
                return e.middle.current;
            });
            expect(Number.isFinite(out[bars.length - 1])).toBe(true);
        }
    });

    it("throws when called outside an active script step", () => {
        expect(() => envelope("oops", { current: 1, length: 0 }, { length: 5 })).toThrowError(
            /ta.envelope called outside an active script step/,
        );
    });

    it("propagates NaN to upper/lower when source middle is NaN", () => {
        const bars = syntheticBars(8, 19);
        const out = harness(bars, bars.length + 1, (b) => {
            const e = envelope("slot", b.close, { length: 5 });
            return { u: e.upper.current, l: e.lower.current };
        });
        for (let i = 0; i < 4; i += 1) {
            expect(Number.isNaN(out[i].u)).toBe(true);
            expect(Number.isNaN(out[i].l)).toBe(true);
        }
    });

    it("middle is identity-shared with the composed MA sub-slot's series", () => {
        const closes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const bars = closes.map((c, i) => makeBar(c, i));
        const refs = harness(bars, bars.length + 1, (b) => {
            const e = envelope("slot", b.close, { length: 5, maType: "sma" });
            return e.middle;
        });
        expect(refs[0]).toBe(refs[1]);
    });
});

describe("ta.envelope tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(15, 23);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (b) =>
            envelope("slot", b.close, { length: 5 }),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, close: last.close + 100 }, () =>
            envelope("slot", last.close + 100, { length: 5 }),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same heads", () => {
        const bars = syntheticBars(20, 25);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (b) =>
            envelope("slot", b.close, { length: 5 }),
        );
        const last = bars[bars.length - 1];
        const tickBar = { ...last, close: last.close + 5 };
        const a = tick(ctxRef, tickBar, () => {
            const e = envelope("slot", tickBar.close, { length: 5 });
            return { u: e.upper.current, m: e.middle.current, l: e.lower.current };
        });
        const b = tick(ctxRef, tickBar, () => {
            const e = envelope("slot", tickBar.close, { length: 5 });
            return { u: e.upper.current, m: e.middle.current, l: e.lower.current };
        });
        expect(b.u).toBe(a.u);
        expect(b.m).toBe(a.m);
        expect(b.l).toBe(a.l);
    });
});
