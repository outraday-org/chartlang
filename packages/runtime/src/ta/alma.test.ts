// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { alma } from "./alma";

function referenceAlma(
    input: Float64Array,
    length: number,
    offsetCentre: number,
    sigma: number,
): Float64Array {
    const n = input.length;
    const out = new Float64Array(n);
    out.fill(Number.NaN);
    const m = offsetCentre * (length - 1);
    const s = length / sigma;
    const weights = new Float64Array(length);
    let normaliser = 0;
    for (let j = 0; j < length; j += 1) {
        const d = j - m;
        weights[j] = Math.exp(-(d * d) / (2 * s * s));
        normaliser += weights[j];
    }
    for (let i = length - 1; i < n; i += 1) {
        let sum = 0;
        let bad = false;
        for (let j = 0; j < length; j += 1) {
            const v = input[i - length + 1 + j];
            if (!Number.isFinite(v)) {
                bad = true;
                break;
            }
            sum += v * weights[j];
        }
        out[i] = bad ? Number.NaN : sum / normaliser;
    }
    return out;
}

describe("ta.alma", () => {
    it("matches the reference ALMA over a 30-bar synthetic walk", () => {
        const bars = syntheticBars(30, 11);
        const closes = new Float64Array(bars.map((b) => b.close));
        const expected = referenceAlma(closes, 9, 0.85, 6);
        const actual = harness(
            bars,
            bars.length + 1,
            (bar) => alma("slot", bar.close, 9, { offset: 0.85, sigma: 6 }).current,
        );
        for (let i = 0; i < bars.length; i += 1) {
            const a = actual[i];
            const e = expected[i];
            if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
            else expect(a).toBeCloseTo(e, 10);
        }
    });

    it("uses defaults (offset=0.85, sigma=6) when opts omitted", () => {
        const bars = syntheticBars(20, 4);
        const closes = new Float64Array(bars.map((b) => b.close));
        const expected = referenceAlma(closes, 9, 0.85, 6);
        const actual = harness(bars, bars.length + 1, (bar) => alma("slot", bar.close, 9).current);
        for (let i = 0; i < bars.length; i += 1) {
            const a = actual[i];
            const e = expected[i];
            if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
            else expect(a).toBeCloseTo(e, 10);
        }
    });

    it("emits NaN until the window is filled", () => {
        const bars = syntheticBars(15, 5);
        const out = harness(bars, bars.length + 1, (bar) => alma("slot", bar.close, 5).current);
        for (let i = 0; i < 4; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[4])).toBe(true);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = alma("slot", bar.close, 5);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => alma("oops", 1, 5)).toThrowError(
            /ta.alma called outside an active script step/,
        );
    });

    it("emits NaN when any source in the window is NaN", () => {
        const bars = syntheticBars(20, 4).map((b, i) =>
            i === 10 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => alma("slot", bar.close, 5).current);
        // Window covers [t-4..t]; bar 10 NaN poisons bars 10..14.
        for (let i = 10; i <= 14; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
        expect(Number.isFinite(out[15])).toBe(true);
    });

    it("equals the constant for a constant-input stream past warmup", () => {
        const bars = Array.from({ length: 10 }, (_, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: 4,
            high: 4,
            low: 4,
            close: 4,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => alma("slot", bar.close, 5).current);
        for (let i = 4; i < bars.length; i += 1) {
            expect(out[i]).toBeCloseTo(4, 12);
        }
    });
});

describe("ta.alma tick-mode", () => {
    it("replaces the head without advancing the buffer", () => {
        const bars = syntheticBars(15, 8);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            alma("slot", bar.close, 5),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickClose = bars[bars.length - 1].close + 5;
        tick(ctxRef, { ...bars[bars.length - 1], close: tickClose }, () =>
            alma("slot", tickClose, 5),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(20, 9);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            alma("slot", bar.close, 5),
        );
        const tickClose = bars[bars.length - 1].close + 10;
        const tickBar = { ...bars[bars.length - 1], close: tickClose };
        const a = tick(ctxRef, tickBar, () => alma("slot", tickClose, 5).current);
        const b = tick(ctxRef, tickBar, () => alma("slot", tickClose, 5).current);
        expect(b).toBeCloseTo(a, 12);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            alma("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[2], () => alma("slot", bars[2].close, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with NaN source returns NaN", () => {
        const bars = syntheticBars(20, 1);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            alma("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[bars.length - 1], () => alma("slot", Number.NaN, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick value matches a recomputed reference against the closed window", () => {
        const bars = syntheticBars(20, 3);
        const length = 5;
        const offsetCentre = 0.85;
        const sigma = 6;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            alma("slot", bar.close, length, { offset: offsetCentre, sigma }),
        );
        const tickClose = bars[bars.length - 1].close + 2;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], close: tickClose },
            () => alma("slot", tickClose, length, { offset: offsetCentre, sigma }).current,
        );

        // Build the reference window: bars[N-5..N-2] + tickClose at head.
        const window = [
            bars[bars.length - 5].close,
            bars[bars.length - 4].close,
            bars[bars.length - 3].close,
            bars[bars.length - 2].close,
            tickClose,
        ];
        const m = offsetCentre * (length - 1);
        const s = length / sigma;
        let sum = 0;
        let norm = 0;
        for (let j = 0; j < length; j += 1) {
            const w = Math.exp(-((j - m) ** 2) / (2 * s * s));
            sum += w * window[j];
            norm += w;
        }
        expect(head).toBeCloseTo(sum / norm, 10);
    });
});
