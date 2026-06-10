// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { vortex } from "./vortex.js";

function bar(i: number, high: number, low: number, close: number): Bar {
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open: (high + low) / 2,
        high,
        low,
        close,
        volume: 0,
        symbol: "T",
        interval: "1m",
    };
}

describe("ta.vortex", () => {
    it("emits NaN through the `length`-bar warmup, finite after", () => {
        const bars = syntheticBars(25, 3);
        const out = harness(bars, bars.length + 1, () => {
            const v = vortex("slot", 5);
            return { plus: v.plus.current, minus: v.minus.current };
        });
        for (let i = 0; i < 5; i += 1) {
            expect(Number.isNaN(out[i].plus)).toBe(true);
            expect(Number.isNaN(out[i].minus)).toBe(true);
        }
        expect(Number.isFinite(out[5].plus)).toBe(true);
        expect(Number.isFinite(out[5].minus)).toBe(true);
    });

    it("returns the same VortexResult identity on every close", () => {
        const bars = syntheticBars(20, 7);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            ids.add(vortex("slot", 5));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => vortex("oops", 14)).toThrowError(
            /ta.vortex called outside an active script step/,
        );
    });

    it("matches a strictly-ascending high series — vmPlus dominates", () => {
        // Highs ascend by 1 each bar; lows also ascend by 1 (parallel).
        // vmPlus[i] = |high[i] - low[i-1]| = 2 (high jumps 1 + spread of 1).
        // vmMinus[i] = |low[i] - high[i-1]| = 0 (low never goes below prevHigh).
        // So plus should dominate.
        const bars: Bar[] = [];
        for (let i = 0; i < 20; i += 1) {
            bars.push(bar(i, 10 + i, 9 + i, 9.5 + i));
        }
        const out = harness(bars, bars.length + 1, () => {
            const v = vortex("slot", 5);
            return { plus: v.plus.current, minus: v.minus.current };
        });
        const lastIdx = bars.length - 1;
        expect(out[lastIdx].plus).toBeGreaterThan(out[lastIdx].minus);
    });

    it("NaN input → NaN outputs, state held forward", () => {
        const bars = syntheticBars(10, 11);
        const nanBar = bar(10, Number.NaN, Number.NaN, Number.NaN);
        const all = [...bars, nanBar];
        const out = harness(all, all.length + 1, () => {
            const v = vortex("slot", 5);
            return { plus: v.plus.current, minus: v.minus.current };
        });
        expect(Number.isNaN(out[out.length - 1].plus)).toBe(true);
        expect(Number.isNaN(out[out.length - 1].minus)).toBe(true);
    });

    it("zero-TR window → NaN (chartlang surfaces degenerate window)", () => {
        // Flat OHLC → tr = 0 every bar → running sum of TR = 0 → NaN.
        const bars: Bar[] = [];
        for (let i = 0; i < 10; i += 1) bars.push(bar(i, 5, 5, 5));
        const out = harness(bars, bars.length + 1, () => {
            const v = vortex("slot", 3);
            return { plus: v.plus.current, minus: v.minus.current };
        });
        // After warmup, every output should be NaN (zero TR window).
        for (let i = 3; i < out.length; i += 1) {
            expect(Number.isNaN(out[i].plus)).toBe(true);
            expect(Number.isNaN(out[i].minus)).toBe(true);
        }
    });
});

describe("ta.vortex tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(20, 21);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => vortex("slot", 5));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, high: last.high + 10, low: last.low - 10 }, () =>
            vortex("slot", 5),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(20, 23);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => vortex("slot", 5));
        const last = bars[bars.length - 1];
        const tickBar = { ...last, high: last.high + 1, low: last.low - 1 };
        const a = tick(ctxRef, tickBar, () => {
            const v = vortex("slot", 5);
            return { plus: v.plus.current, minus: v.minus.current };
        });
        const b = tick(ctxRef, tickBar, () => {
            const v = vortex("slot", 5);
            return { plus: v.plus.current, minus: v.minus.current };
        });
        if (Number.isNaN(a.plus)) expect(Number.isNaN(b.plus)).toBe(true);
        else expect(b.plus).toBe(a.plus);
        if (Number.isNaN(a.minus)) expect(Number.isNaN(b.minus)).toBe(true);
        else expect(b.minus).toBe(a.minus);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 31);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () => vortex("slot", 5));
        const head = tick(ctxRef, bars[2], () => {
            const v = vortex("slot", 5);
            return { plus: v.plus.current, minus: v.minus.current };
        });
        expect(Number.isNaN(head.plus)).toBe(true);
        expect(Number.isNaN(head.minus)).toBe(true);
    });

    it("non-finite tick high → NaN", () => {
        const bars = syntheticBars(15, 41);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => vortex("slot", 5));
        const last = bars[bars.length - 1];
        const head = tick(ctxRef, { ...last, high: Number.NaN }, () => {
            const v = vortex("slot", 5);
            return { plus: v.plus.current, minus: v.minus.current };
        });
        expect(Number.isNaN(head.plus)).toBe(true);
        expect(Number.isNaN(head.minus)).toBe(true);
    });
});

describe("ta.vortex opts.offset", () => {
    it("offset 0 returns the canonical result by identity", () => {
        const bars = syntheticBars(20, 51);
        const seen = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            seen.add(vortex("slot", 5, { offset: 0 }));
            return null;
        });
        expect(seen.size).toBe(1);
    });

    it("non-zero offset returns a stable cached shifted result", () => {
        const bars = syntheticBars(20, 53);
        const refs: unknown[] = [];
        harness(bars, bars.length + 1, () => {
            refs.push(vortex("slot", 5, { offset: 2 }));
            return null;
        });
        for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
    });
});
