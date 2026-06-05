// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { computeMaOfFloat64 } from "./lib/computeMaOfFloat64";
import { maRibbon, maRibbonOutputKeys } from "./maRibbon";

describe("ta.maRibbon", () => {
    it("default opts → 5 outputs keyed ma_10..ma_50, sma dispatch", () => {
        const bars = syntheticBars(60, 11);
        const closes = new Float64Array(bars.map((b) => b.close));
        const captured: number[][] = [[], [], [], [], []];
        harness(bars, bars.length + 1, (bar) => {
            const r = maRibbon("slot", bar.close);
            captured[0].push(r.ma_10.current);
            captured[1].push(r.ma_20.current);
            captured[2].push(r.ma_30.current);
            captured[3].push(r.ma_40.current);
            captured[4].push(r.ma_50.current);
            return null;
        });
        const lengths = [10, 20, 30, 40, 50];
        for (let k = 0; k < 5; k += 1) {
            const expected = computeMaOfFloat64("sma", closes, lengths[k]);
            for (let i = 0; i < bars.length; i += 1) {
                const a = captured[k][i];
                const e = expected[i];
                if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
                else expect(a).toBeCloseTo(e, 10);
            }
        }
    });

    it("custom lengths + ema dispatch matches per-length computeMaOfFloat64", () => {
        const bars = syntheticBars(50, 7);
        const closes = new Float64Array(bars.map((b) => b.close));
        const lengths = [5, 10, 15];
        const captured: Record<string, number[]> = { ma_5: [], ma_10: [], ma_15: [] };
        harness(bars, bars.length + 1, (bar) => {
            const r = maRibbon("slot", bar.close, { lengths, maType: "ema" });
            captured.ma_5.push(r.ma_5.current);
            captured.ma_10.push(r.ma_10.current);
            captured.ma_15.push(r.ma_15.current);
            return null;
        });
        for (const length of lengths) {
            const key = `ma_${length}`;
            const expected = computeMaOfFloat64("ema", closes, length);
            for (let i = 0; i < bars.length; i += 1) {
                const a = captured[key][i];
                const e = expected[i];
                if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
                else expect(a).toBeCloseTo(e, 8);
            }
        }
    });

    it("each output Series identity is stable across bars", () => {
        const bars = syntheticBars(10, 1);
        const ids = new Map<string, Set<unknown>>();
        harness(bars, bars.length + 1, (bar) => {
            const r = maRibbon("slot", bar.close, { lengths: [3, 5], maType: "sma" });
            for (const k of ["ma_3", "ma_5"]) {
                if (!ids.has(k)) ids.set(k, new Set());
                ids.get(k)?.add(r[k]);
            }
            return null;
        });
        for (const set of ids.values()) expect(set.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => maRibbon("oops", 1)).toThrowError(
            /ta.maRibbon called outside an active script step/,
        );
    });

    it("smma + wma dispatch paths produce matching outputs", () => {
        const bars = syntheticBars(40, 3);
        const closes = new Float64Array(bars.map((b) => b.close));
        const lengths = [5, 10];
        const smmaActual: number[] = [];
        const wmaActual: number[] = [];
        harness(bars, bars.length + 1, (bar) => {
            const r1 = maRibbon("slotA", bar.close, { lengths, maType: "smma" });
            const r2 = maRibbon("slotB", bar.close, { lengths, maType: "wma" });
            smmaActual.push(r1.ma_5.current);
            wmaActual.push(r2.ma_5.current);
            return null;
        });
        const smmaExpected = computeMaOfFloat64("smma", closes, 5);
        const wmaExpected = computeMaOfFloat64("wma", closes, 5);
        for (let i = 0; i < bars.length; i += 1) {
            if (Number.isNaN(smmaExpected[i])) expect(Number.isNaN(smmaActual[i])).toBe(true);
            else expect(smmaActual[i]).toBeCloseTo(smmaExpected[i], 8);
            if (Number.isNaN(wmaExpected[i])) expect(Number.isNaN(wmaActual[i])).toBe(true);
            else expect(wmaActual[i]).toBeCloseTo(wmaExpected[i], 8);
        }
    });

    it("returns the cached MaRibbonResult identity across bars", () => {
        const bars = syntheticBars(8, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const r = maRibbon("slot", bar.close, { lengths: [3, 5] });
            identities.add(r);
            return null;
        });
        expect(identities.size).toBe(1);
    });
});

describe("ta.maRibbon tick-mode", () => {
    it("replaces head on every sub-slot without advancing", () => {
        const bars = syntheticBars(30, 8);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            maRibbon("slot", bar.close, { lengths: [3, 5], maType: "sma" }),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickClose = bars[bars.length - 1].close + 5;
        tick(ctxRef, { ...bars[bars.length - 1], close: tickClose }, () =>
            maRibbon("slot", tickClose, { lengths: [3, 5], maType: "sma" }),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce identical heads on every output", () => {
        const bars = syntheticBars(30, 9);
        const opts = { lengths: [4, 8], maType: "sma" } as const;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            maRibbon("slot", bar.close, opts),
        );
        const tickClose = bars[bars.length - 1].close + 10;
        const tickBar = { ...bars[bars.length - 1], close: tickClose };
        const a = tick(ctxRef, tickBar, () => {
            const r = maRibbon("slot", tickClose, opts);
            return [r.ma_4.current, r.ma_8.current];
        });
        const b = tick(ctxRef, tickBar, () => {
            const r = maRibbon("slot", tickClose, opts);
            return [r.ma_4.current, r.ma_8.current];
        });
        expect(b[0]).toBeCloseTo(a[0], 12);
        expect(b[1]).toBeCloseTo(a[1], 12);
    });
});

describe("maRibbonOutputKeys", () => {
    it("returns the default ma_10..ma_50 keys on no-opts", () => {
        expect(maRibbonOutputKeys()).toEqual(["ma_10", "ma_20", "ma_30", "ma_40", "ma_50"]);
    });

    it("returns ma_<length> per element in opts.lengths in order", () => {
        expect(maRibbonOutputKeys({ lengths: [3, 8, 21] })).toEqual(["ma_3", "ma_8", "ma_21"]);
    });

    it("returns the default keys when only maType is passed", () => {
        expect(maRibbonOutputKeys({ maType: "ema" })).toEqual([
            "ma_10",
            "ma_20",
            "ma_30",
            "ma_40",
            "ma_50",
        ]);
    });
});
