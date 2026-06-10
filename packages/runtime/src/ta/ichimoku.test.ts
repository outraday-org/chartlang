// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { ichimoku } from "./ichimoku.js";

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

describe("ta.ichimoku", () => {
    it("tenkan first defined at bar `conversionLength - 1`", () => {
        const bars = syntheticBars(60, 3);
        const out = harness(bars, bars.length + 1, () => {
            const i = ichimoku("slot", {
                conversionLength: 9,
                baseLength: 26,
                leadingSpanBLength: 52,
                displacement: 26,
            });
            return i.tenkan.current;
        });
        for (let i = 0; i < 8; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[8])).toBe(true);
    });

    it("kijun first defined at bar `baseLength - 1`", () => {
        const bars = syntheticBars(60, 5);
        const out = harness(bars, bars.length + 1, () => {
            const i = ichimoku("slot", {
                conversionLength: 9,
                baseLength: 26,
                leadingSpanBLength: 52,
                displacement: 26,
            });
            return i.kijun.current;
        });
        for (let i = 0; i < 25; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[25])).toBe(true);
    });

    it("senkouA first defined at `max(conversionLength, baseLength) + displacement - 1`", () => {
        const bars = syntheticBars(80, 7);
        const out = harness(bars, bars.length + 1, () => {
            const i = ichimoku("slot", {
                conversionLength: 9,
                baseLength: 26,
                leadingSpanBLength: 52,
                displacement: 26,
            });
            return i.senkouA.current;
        });
        // senkouA raw first defined at max(8, 25) = 25; displaced by 26
        // → first defined at index 25 + 26 = 51.
        for (let i = 0; i < 51; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[51])).toBe(true);
    });

    it("senkouB first defined at `leadingSpanBLength + displacement - 1`", () => {
        const bars = syntheticBars(90, 11);
        const out = harness(bars, bars.length + 1, () => {
            const i = ichimoku("slot", {
                conversionLength: 9,
                baseLength: 26,
                leadingSpanBLength: 52,
                displacement: 26,
            });
            return i.senkouB.current;
        });
        // senkouB raw first defined at 51; displaced by 26 → 77.
        for (let i = 0; i < 77; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[77])).toBe(true);
    });

    it("chikou is the backward-shifted close: chikou[t] = close[t - displacement]", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 40; i += 1) bars.push(bar(i, 100 + i, 99 + i, 99.5 + i));
        const out = harness(bars, bars.length + 1, () => {
            const i = ichimoku("slot", {
                conversionLength: 3,
                baseLength: 5,
                leadingSpanBLength: 7,
                displacement: 4,
            });
            return i.chikou.current;
        });
        for (let i = 0; i < 4; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        for (let i = 4; i < bars.length; i += 1) {
            expect(out[i]).toBe(bars[i - 4].close);
        }
    });

    it("tenkan = (highest(high, n) + lowest(low, n)) / 2", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 20; i += 1) bars.push(bar(i, 10 + i, 5 + i, 7 + i));
        const out = harness(bars, bars.length + 1, () => {
            const i = ichimoku("slot", {
                conversionLength: 5,
                baseLength: 10,
                leadingSpanBLength: 15,
                displacement: 5,
            });
            return i.tenkan.current;
        });
        // At index 4 (first defined), window of highs [10..14], lows [5..9].
        // tenkan = (14 + 5) / 2 = 9.5.
        expect(out[4]).toBeCloseTo(9.5, 10);
    });

    it("returns the same IchimokuResult identity on every close", () => {
        const bars = syntheticBars(20, 13);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            ids.add(ichimoku("slot"));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("default opts produce the canonical (9, 26, 52, 26) Ichimoku", () => {
        const bars = syntheticBars(100, 17);
        const outDefault = harness(bars, bars.length + 1, () => {
            const i = ichimoku("slot");
            return i.tenkan.current;
        });
        const outExplicit = harness(bars, bars.length + 1, () => {
            const i = ichimoku("slot2", {
                conversionLength: 9,
                baseLength: 26,
                leadingSpanBLength: 52,
                displacement: 26,
            });
            return i.tenkan.current;
        });
        for (let i = 0; i < bars.length; i += 1) {
            if (Number.isNaN(outDefault[i])) expect(Number.isNaN(outExplicit[i])).toBe(true);
            else expect(outExplicit[i]).toBe(outDefault[i]);
        }
    });

    it("throws when called outside an active script step", () => {
        expect(() => ichimoku("oops")).toThrowError(
            /ta.ichimoku called outside an active script step/,
        );
    });

    it("NaN high → tenkan NaN", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 15; i += 1) bars.push(bar(i, Number.NaN, Number.NaN, Number.NaN));
        const out = harness(bars, bars.length + 1, () => {
            const i = ichimoku("slot", {
                conversionLength: 5,
                baseLength: 5,
                leadingSpanBLength: 5,
                displacement: 2,
            });
            return i.tenkan.current;
        });
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });
});

describe("ta.ichimoku tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(60, 21);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => ichimoku("slot"));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, high: last.high + 100, low: last.low - 100 }, () =>
            ichimoku("slot"),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same tenkan head", () => {
        const bars = syntheticBars(60, 23);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => ichimoku("slot"));
        const last = bars[bars.length - 1];
        const tickBar = { ...last, high: last.high + 5, low: last.low - 5 };
        const a = tick(ctxRef, tickBar, () => ichimoku("slot").tenkan.current);
        const b = tick(ctxRef, tickBar, () => ichimoku("slot").tenkan.current);
        if (Number.isNaN(a)) expect(Number.isNaN(b)).toBe(true);
        else expect(b).toBe(a);
    });

    it("displaced senkouA head is stable across consecutive ticks", () => {
        const bars = syntheticBars(80, 27);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => ichimoku("slot"));
        const last = bars[bars.length - 1];
        const tickBar = { ...last, high: last.high + 1000, low: last.low - 1000 };
        const a = tick(ctxRef, tickBar, () => ichimoku("slot").senkouA.current);
        const b = tick(ctxRef, tickBar, () => ichimoku("slot").senkouA.current);
        if (Number.isNaN(a)) expect(Number.isNaN(b)).toBe(true);
        else expect(b).toBe(a);
    });
});

describe("ta.ichimoku opts.offset", () => {
    it("offset 0 returns the canonical result by identity", () => {
        const bars = syntheticBars(60, 51);
        const seen = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            seen.add(ichimoku("slot", { offset: 0 }));
            return null;
        });
        expect(seen.size).toBe(1);
    });

    it("non-zero offset returns a stable cached shifted result", () => {
        const bars = syntheticBars(60, 53);
        const refs: unknown[] = [];
        harness(bars, bars.length + 1, () => {
            refs.push(ichimoku("slot", { offset: 3 }));
            return null;
        });
        for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
    });
});
