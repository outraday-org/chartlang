// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { dema } from "./dema.js";
import { computeEmaOfFloat64 } from "./lib/emaFloat64.js";

function referenceDema(input: Float64Array, length: number): Float64Array {
    const ema1 = computeEmaOfFloat64(input, length);
    const ema2 = computeEmaOfFloat64(ema1, length);
    const out = new Float64Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
        const e1 = ema1[i];
        const e2 = ema2[i];
        out[i] = Number.isFinite(e1) && Number.isFinite(e2) ? 2 * e1 - e2 : Number.NaN;
    }
    return out;
}

describe("ta.dema", () => {
    it("matches the reference DEMA over a 50-bar synthetic walk", () => {
        const bars = syntheticBars(50, 11);
        const closes = new Float64Array(bars.map((b) => b.close));
        const expected = referenceDema(closes, 10);
        const actual = harness(bars, bars.length + 1, (bar) => dema("slot", bar.close, 10).current);
        for (let i = 0; i < bars.length; i += 1) {
            const a = actual[i];
            const e = expected[i];
            if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
            else expect(a).toBeCloseTo(e, 10);
        }
    });

    it("is finite from the first finite source bar", () => {
        const bars = syntheticBars(20, 5);
        const out = harness(bars, bars.length + 1, (bar) => dema("slot", bar.close, 5).current);
        expect(out[0]).toBe(bars[0].close);
        expect(out.every(Number.isFinite)).toBe(true);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = dema("slot", bar.close, 3);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => dema("oops", 1, 3)).toThrowError(
            /ta.dema called outside an active script step/,
        );
    });

    it("emits NaN on a mid-stream NaN source and resumes the recurrence afterward", () => {
        const bars = syntheticBars(30, 4).map((b, i) =>
            i === 15 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => dema("slot", bar.close, 5).current);
        expect(Number.isFinite(out[14])).toBe(true);
        expect(Number.isNaN(out[15])).toBe(true);
        expect(Number.isFinite(out[16])).toBe(true);
    });

    it("equals the constant for a constant-input stream from bar zero", () => {
        const bars = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5].map((c, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: c,
            high: c,
            low: c,
            close: c,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => dema("slot", bar.close, 3).current);
        for (let i = 0; i < bars.length; i += 1) {
            expect(out[i]).toBeCloseTo(5, 12);
        }
    });
});

describe("ta.dema tick-mode", () => {
    it("replaces the head without advancing the buffer", () => {
        const bars = syntheticBars(20, 8);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            dema("slot", bar.close, 4),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickClose = bars[bars.length - 1].close + 5;
        tick(ctxRef, { ...bars[bars.length - 1], close: tickClose }, () =>
            dema("slot", tickClose, 4),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(30, 9);
        const length = 5;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            dema("slot", bar.close, length),
        );
        const tickClose = bars[bars.length - 1].close + 10;
        const tickBar = { ...bars[bars.length - 1], close: tickClose };
        const a = tick(ctxRef, tickBar, () => dema("slot", tickClose, length).current);
        const b = tick(ctxRef, tickBar, () => dema("slot", tickClose, length).current);
        expect(b).toBeCloseTo(a, 12);
    });

    it("tick remains finite before length bars have closed", () => {
        const bars = syntheticBars(3, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            dema("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[2], () => dema("slot", bars[2].close, 5).current);
        expect(Number.isFinite(head)).toBe(true);
    });

    it("tick with NaN source emits NaN", () => {
        const bars = syntheticBars(30, 1);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            dema("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[bars.length - 1], () => dema("slot", Number.NaN, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });
});
