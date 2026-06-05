// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { hma } from "./hma";
import { wmaFloat64 } from "./lib/wmaFloat64";

function referenceHma(closes: Float64Array, length: number): Float64Array {
    const halfLen = Math.max(1, Math.floor(length / 2));
    const sqrtLen = Math.max(1, Math.round(Math.sqrt(length)));
    const half = wmaFloat64(closes, halfLen);
    const full = wmaFloat64(closes, length);
    const diff = new Float64Array(closes.length);
    for (let i = 0; i < closes.length; i += 1) {
        const h = half[i];
        const f = full[i];
        diff[i] = Number.isFinite(h) && Number.isFinite(f) ? 2 * h - f : Number.NaN;
    }
    return wmaFloat64(diff, sqrtLen);
}

describe("ta.hma", () => {
    it("matches the reference HMA over a 60-bar synthetic walk", () => {
        const bars = syntheticBars(60, 13);
        const closes = new Float64Array(bars.map((b) => b.close));
        const length = 16;
        const expected = referenceHma(closes, length);
        const actual = harness(
            bars,
            bars.length + 1,
            (bar) => hma("slot", bar.close, length).current,
        );
        for (let i = 0; i < bars.length; i += 1) {
            const a = actual[i];
            const e = expected[i];
            if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
            else expect(a).toBeCloseTo(e, 10);
        }
    });

    it("emits NaN until the full chain warmup completes", () => {
        const bars = syntheticBars(40, 5);
        const length = 9;
        // warmup = length + ceil(sqrt(length)) - 2 = 9 + 3 - 2 = 10.
        // First defined value at bar 10.
        const out = harness(bars, bars.length + 1, (bar) => hma("slot", bar.close, length).current);
        for (let i = 0; i < 10; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[10])).toBe(true);
    });

    it("allocates three WMA sub-slots derived from the parent slot id", () => {
        const bars = syntheticBars(30, 1);
        harness(bars, bars.length + 1, (_bar, ctx) => {
            hma("hma-id", _bar.close, 9);
            const slots = ctx.stream.taSlots;
            expect(slots.has("hma-id")).toBe(true);
            expect(slots.has("hma-id/half")).toBe(true);
            expect(slots.has("hma-id/full")).toBe(true);
            expect(slots.has("hma-id/final")).toBe(true);
            return null;
        });
    });

    it("equals the constant for a constant-input stream past warmup", () => {
        const bars = Array.from({ length: 20 }, (_, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: 42,
            high: 42,
            low: 42,
            close: 42,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => hma("slot", bar.close, 9).current);
        // HMA on a constant input — every WMA reduces to the constant.
        // 2·c − c = c; final WMA of c = c.
        for (let i = 10; i < bars.length; i += 1) {
            expect(out[i]).toBeCloseTo(42, 12);
        }
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(15, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = hma("slot", bar.close, 9);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => hma("oops", 1, 9)).toThrowError(/ta.hma called outside an active script step/);
    });

    it("emits NaN when the source is NaN before the chain warms", () => {
        const bars = syntheticBars(20, 4).map((b, i) =>
            i === 5 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => hma("slot", bar.close, 9).current);
        // Bar 5's NaN ripples through half (window 4) and full (window 9).
        expect(Number.isNaN(out[5])).toBe(true);
    });
});

describe("ta.hma tick-mode", () => {
    it("replaces the head without advancing the stream length", () => {
        const bars = syntheticBars(40, 8);
        const length = 9;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            hma("slot", bar.close, length),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickClose = bars[bars.length - 1].close + 5;
        tick(ctxRef, { ...bars[bars.length - 1], close: tickClose }, () =>
            hma("slot", tickClose, length),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(40, 9);
        const length = 9;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            hma("slot", bar.close, length),
        );
        const tickClose = bars[bars.length - 1].close + 10;
        const tickBar = { ...bars[bars.length - 1], close: tickClose };
        const a = tick(ctxRef, tickBar, () => hma("slot", tickClose, length).current);
        const b = tick(ctxRef, tickBar, () => hma("slot", tickClose, length).current);
        expect(b).toBeCloseTo(a, 12);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(5, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 6, (bar) =>
            hma("slot", bar.close, 9),
        );
        const head = tick(ctxRef, bars[4], () => hma("slot", bars[4].close, 9).current);
        expect(Number.isNaN(head)).toBe(true);
    });
});
