// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { volatilityStop } from "./volatilityStop.js";

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

describe("ta.volatilityStop", () => {
    it("emits NaN until ATR is warm (length bars)", () => {
        const bars = syntheticBars(20, 3);
        const out = harness(bars, bars.length + 1, () => {
            const v = volatilityStop("slot", { length: 5, multiplier: 2 });
            return { value: v.value.current, direction: v.direction.current };
        });
        // ATR warmup is `length`. First `length - 1` outputs are NaN
        // (ATR NaN). Bar at `length - 1` (1-based barCount === length)
        // is the first warm bar — but we need 2 finite-ATR bars to
        // decide direction (need prevSrc), so the first warm bar
        // emits NaN too, and the second warm bar (bar `length`) is
        // the first finite output.
        for (let i = 0; i < 5; i += 1) {
            expect(Number.isNaN(out[i].value)).toBe(true);
        }
        expect(Number.isFinite(out[5].value)).toBe(true);
        expect(out[5].direction === 1 || out[5].direction === -1).toBe(true);
    });

    it("strong uptrend → direction = +1", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 20; i += 1) {
            bars.push(makeBar(100 + i, 101 + i, 99 + i, 100 + i, i));
        }
        const out = harness(bars, bars.length + 1, () => {
            const v = volatilityStop("slot", { length: 5, multiplier: 2 });
            return v.direction.current;
        });
        for (let i = 6; i < bars.length; i += 1) expect(out[i]).toBe(1);
    });

    it("strong downtrend after warm reverses to direction = -1", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 10; i += 1) {
            bars.push(makeBar(100 + i, 101 + i, 99 + i, 100 + i, i));
        }
        for (let i = 0; i < 15; i += 1) {
            bars.push(makeBar(110 - i * 3, 111 - i * 3, 109 - i * 3 - 5, 100 - i * 3, 10 + i));
        }
        const out = harness(bars, bars.length + 1, () => {
            const v = volatilityStop("slot", { length: 5, multiplier: 2 });
            return v.direction.current;
        });
        const flipped = out.some((d) => d === -1);
        expect(flipped).toBe(true);
    });

    it("returns the same VolatilityStopResult identity on every call", () => {
        const bars = syntheticBars(20, 7);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            ids.add(volatilityStop("slot"));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => volatilityStop("oops")).toThrowError(
            /ta.volatilityStop called outside an active script step/,
        );
    });

    it("NaN OHLC → NaN outputs, state freezes", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 10; i += 1) {
            bars.push(makeBar(100 + i, 101 + i, 99 + i, 100 + i, i));
        }
        bars.push({ ...makeBar(0, Number.NaN, Number.NaN, Number.NaN, 10) });
        bars.push(makeBar(110, 111, 109, 110, 11));
        const out = harness(bars, bars.length + 1, () => {
            const v = volatilityStop("slot", { length: 5, multiplier: 2 });
            return { value: v.value.current, direction: v.direction.current };
        });
        expect(Number.isNaN(out[10].value)).toBe(true);
        expect(Number.isNaN(out[10].direction)).toBe(true);
        // Bar 11 resumes — finite (ATR may still emit finite from
        // wilder smoothing which freezes on NaN).
    });

    it("uses defaults: length=20, multiplier=2", () => {
        const bars = syntheticBars(30, 1);
        const out = harness(bars, bars.length + 1, () => volatilityStop("slot").value.current);
        for (let i = 0; i < 19; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        // Bar 20 is the first warm bar (NaN); bar 21 is the second
        // (first finite).
    });
});

describe("ta.volatilityStop tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(20, 11);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            volatilityStop("slot", { length: 5, multiplier: 2 }),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, close: last.close + 100 }, () =>
            volatilityStop("slot", { length: 5, multiplier: 2 }),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(20, 13);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            volatilityStop("slot", { length: 5, multiplier: 2 }),
        );
        const last = bars[bars.length - 1];
        const tickBar = { ...last, close: last.close + 5 };
        const a = tick(ctxRef, tickBar, () => {
            const v = volatilityStop("slot", { length: 5, multiplier: 2 });
            return { value: v.value.current, direction: v.direction.current };
        });
        const b = tick(ctxRef, tickBar, () => {
            const v = volatilityStop("slot", { length: 5, multiplier: 2 });
            return { value: v.value.current, direction: v.direction.current };
        });
        if (Number.isNaN(a.value)) expect(Number.isNaN(b.value)).toBe(true);
        else expect(b.value).toBe(a.value);
        if (Number.isNaN(a.direction)) expect(Number.isNaN(b.direction)).toBe(true);
        else expect(b.direction).toBe(a.direction);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () =>
            volatilityStop("slot", { length: 5, multiplier: 2 }),
        );
        const head = tick(ctxRef, bars[2], () => {
            const v = volatilityStop("slot", { length: 5, multiplier: 2 });
            return { value: v.value.current, direction: v.direction.current };
        });
        expect(Number.isNaN(head.value)).toBe(true);
        expect(Number.isNaN(head.direction)).toBe(true);
    });

    it("tick on the FIRST warm bar (direction undecided) returns NaN", () => {
        // length=5: ATR first becomes finite at bar index 4 (5th bar).
        // After 5 closes, warmBarCount=1 (snapshot captured 0 for
        // bar 4 close). Ticking bar 4 again replays from snapshot,
        // exercising the `prevClosedWarmBarCount === 0` tick branch.
        const bars = syntheticBars(5, 4);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () =>
            volatilityStop("slot", { length: 5, multiplier: 2 }),
        );
        const head = tick(ctxRef, bars[bars.length - 1], () => {
            const v = volatilityStop("slot", { length: 5, multiplier: 2 });
            return { value: v.value.current, direction: v.direction.current };
        });
        expect(Number.isNaN(head.value)).toBe(true);
        expect(Number.isNaN(head.direction)).toBe(true);
    });

    it("tick with NaN OHLC returns NaN", () => {
        const bars = syntheticBars(20, 17);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () =>
            volatilityStop("slot", { length: 5, multiplier: 2 }),
        );
        const last = bars[bars.length - 1];
        const head = tick(
            ctxRef,
            { ...last, close: Number.NaN, high: Number.NaN, low: Number.NaN },
            () => {
                const v = volatilityStop("slot", { length: 5, multiplier: 2 });
                return { value: v.value.current, direction: v.direction.current };
            },
        );
        expect(Number.isNaN(head.value)).toBe(true);
        expect(Number.isNaN(head.direction)).toBe(true);
    });

    it("ticking the last closed bar's own values reproduces the close output", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 12; i += 1) {
            bars.push(makeBar(100 + i, 101 + i, 99 + i, 100 + i, i));
        }
        bars.push(makeBar(112, 112, 50, 50, 12));
        const closedOut = harness(bars, bars.length + 1, () => {
            const v = volatilityStop("slot", { length: 5, multiplier: 2 });
            return { value: v.value.current, direction: v.direction.current };
        });
        const lastClosed = closedOut[closedOut.length - 1];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            volatilityStop("slot", { length: 5, multiplier: 2 }),
        );
        const last = bars[bars.length - 1];
        const tickHead = tick(ctxRef, last, () => {
            const v = volatilityStop("slot", { length: 5, multiplier: 2 });
            return { value: v.value.current, direction: v.direction.current };
        });
        if (Number.isNaN(lastClosed.value)) {
            expect(Number.isNaN(tickHead.value)).toBe(true);
        } else {
            expect(tickHead.value).toBeCloseTo(lastClosed.value, 10);
        }
        if (Number.isNaN(lastClosed.direction)) {
            expect(Number.isNaN(tickHead.direction)).toBe(true);
        } else {
            expect(tickHead.direction).toBe(lastClosed.direction);
        }
    });
});
