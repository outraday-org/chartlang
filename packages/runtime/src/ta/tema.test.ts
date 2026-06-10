// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { computeEmaOfFloat64 } from "./lib/emaFloat64.js";
import { tema } from "./tema.js";

function referenceTema(input: Float64Array, length: number): Float64Array {
    const ema1 = computeEmaOfFloat64(input, length);
    const ema2 = computeEmaOfFloat64(ema1, length);
    const ema3 = computeEmaOfFloat64(ema2, length);
    const out = new Float64Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
        const e1 = ema1[i];
        const e2 = ema2[i];
        const e3 = ema3[i];
        out[i] =
            Number.isFinite(e1) && Number.isFinite(e2) && Number.isFinite(e3)
                ? 3 * e1 - 3 * e2 + e3
                : Number.NaN;
    }
    return out;
}

describe("ta.tema", () => {
    it("matches the reference TEMA over a 60-bar synthetic walk", () => {
        const bars = syntheticBars(60, 11);
        const closes = new Float64Array(bars.map((b) => b.close));
        const expected = referenceTema(closes, 8);
        const actual = harness(bars, bars.length + 1, (bar) => tema("slot", bar.close, 8).current);
        for (let i = 0; i < bars.length; i += 1) {
            const a = actual[i];
            const e = expected[i];
            if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
            else expect(a).toBeCloseTo(e, 10);
        }
    });

    it("emits NaN until 3·length − 3 closed bars", () => {
        const bars = syntheticBars(30, 5);
        const out = harness(bars, bars.length + 1, (bar) => tema("slot", bar.close, 4).current);
        // 3·4 − 3 = 9; first defined at index 9.
        for (let i = 0; i < 9; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[9])).toBe(true);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(15, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = tema("slot", bar.close, 3);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => tema("oops", 1, 3)).toThrowError(
            /ta.tema called outside an active script step/,
        );
    });

    it("equals the constant for a constant-input stream past warmup", () => {
        const bars = Array.from({ length: 20 }, (_, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: 7,
            high: 7,
            low: 7,
            close: 7,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => tema("slot", bar.close, 3).current);
        // 3·3 − 3 = 6 warmup bars; first defined at index 6.
        for (let i = 6; i < bars.length; i += 1) {
            expect(out[i]).toBeCloseTo(7, 12);
        }
    });
});

describe("ta.tema tick-mode", () => {
    it("replaces the head without advancing the buffer", () => {
        const bars = syntheticBars(30, 8);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            tema("slot", bar.close, 4),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickClose = bars[bars.length - 1].close + 5;
        tick(ctxRef, { ...bars[bars.length - 1], close: tickClose }, () =>
            tema("slot", tickClose, 4),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(40, 9);
        const length = 5;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            tema("slot", bar.close, length),
        );
        const tickClose = bars[bars.length - 1].close + 10;
        const tickBar = { ...bars[bars.length - 1], close: tickClose };
        const a = tick(ctxRef, tickBar, () => tema("slot", tickClose, length).current);
        const b = tick(ctxRef, tickBar, () => tema("slot", tickClose, length).current);
        expect(b).toBeCloseTo(a, 12);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(5, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            tema("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[4], () => tema("slot", bars[4].close, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });
});
