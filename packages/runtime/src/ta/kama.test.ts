// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { kama } from "./kama";

function referenceKama(
    src: Float64Array,
    length: number,
    fastLength: number,
    slowLength: number,
): Float64Array {
    const n = src.length;
    const out = new Float64Array(n);
    out.fill(Number.NaN);
    const fast = 2 / (fastLength + 1);
    const slow = 2 / (slowLength + 1);
    let prev = Number.NaN;
    for (let i = length; i < n; i += 1) {
        const headSrc = src[i];
        const oldest = src[i - length];
        if (!Number.isFinite(headSrc) || !Number.isFinite(oldest)) {
            out[i] = prev;
            continue;
        }
        const change = Math.abs(headSrc - oldest);
        let vol = 0;
        let badPair = false;
        for (let j = 0; j < length; j += 1) {
            const a = src[i - j];
            const b = src[i - j - 1];
            if (!Number.isFinite(a) || !Number.isFinite(b)) {
                badPair = true;
                break;
            }
            vol += Math.abs(a - b);
        }
        if (badPair) {
            out[i] = prev;
            continue;
        }
        const er = vol > 0 ? change / vol : 0;
        const sc = (er * (fast - slow) + slow) ** 2;
        if (!Number.isFinite(prev)) {
            prev = headSrc;
        } else {
            prev = prev + sc * (headSrc - prev);
        }
        out[i] = prev;
    }
    return out;
}

describe("ta.kama", () => {
    it("matches the reference KAMA over a 60-bar synthetic walk", () => {
        const bars = syntheticBars(60, 11);
        const closes = new Float64Array(bars.map((b) => b.close));
        const expected = referenceKama(closes, 10, 2, 30);
        const actual = harness(
            bars,
            bars.length + 1,
            (bar) => kama("slot", bar.close, { length: 10, fastLength: 2, slowLength: 30 }).current,
        );
        for (let i = 0; i < bars.length; i += 1) {
            const a = actual[i];
            const e = expected[i];
            if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
            else expect(a).toBeCloseTo(e, 10);
        }
    });

    it("uses defaults (length=10, fast=2, slow=30) when opts omitted", () => {
        const bars = syntheticBars(30, 4);
        const closes = new Float64Array(bars.map((b) => b.close));
        const expected = referenceKama(closes, 10, 2, 30);
        const actual = harness(bars, bars.length + 1, (bar) => kama("slot", bar.close).current);
        for (let i = 0; i < bars.length; i += 1) {
            const a = actual[i];
            const e = expected[i];
            if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
            else expect(a).toBeCloseTo(e, 10);
        }
    });

    it("emits NaN for the first `length` bars", () => {
        const bars = syntheticBars(20, 5);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => kama("slot", bar.close, { length: 5 }).current,
        );
        for (let i = 0; i < 5; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[5])).toBe(true);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(15, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = kama("slot", bar.close, { length: 5 });
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => kama("oops", 1)).toThrowError(/ta.kama called outside an active script step/);
    });

    it("constant source → output equals source (zero-volatility regime)", () => {
        const bars = Array.from({ length: 25 }, (_, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: 12,
            high: 12,
            low: 12,
            close: 12,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => kama("slot", bar.close, { length: 5 }).current,
        );
        // Warmup index 0..4 → NaN; from index 5 onward output stays at 12.
        for (let i = 5; i < bars.length; i += 1) {
            expect(out[i]).toBeCloseTo(12, 12);
        }
    });

    it("forward-fills the prior value on a mid-stream NaN source", () => {
        const bars = syntheticBars(30, 7).map((b, i) =>
            i === 20 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => kama("slot", bar.close, { length: 5 }).current,
        );
        // Bar 19 is defined (past warmup); bar 20 forward-fills to bar 19's value.
        const before = out[19];
        const atNan = out[20];
        expect(Number.isFinite(before)).toBe(true);
        expect(atNan).toBe(before);
    });
});

describe("ta.kama tick-mode", () => {
    it("replaces the head without advancing the buffer", () => {
        const bars = syntheticBars(20, 8);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            kama("slot", bar.close, { length: 5 }),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickClose = bars[bars.length - 1].close + 5;
        tick(ctxRef, { ...bars[bars.length - 1], close: tickClose }, () =>
            kama("slot", tickClose, { length: 5 }),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(20, 9);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            kama("slot", bar.close, { length: 5 }),
        );
        const tickClose = bars[bars.length - 1].close + 7;
        const tickBar = { ...bars[bars.length - 1], close: tickClose };
        const a = tick(ctxRef, tickBar, () => kama("slot", tickClose, { length: 5 }).current);
        const b = tick(ctxRef, tickBar, () => kama("slot", tickClose, { length: 5 }).current);
        expect(b).toBeCloseTo(a, 12);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            kama("slot", bar.close, { length: 10 }),
        );
        const head = tick(
            ctxRef,
            bars[2],
            () => kama("slot", bars[2].close, { length: 10 }).current,
        );
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with NaN source carries the prior closed KAMA forward", () => {
        const bars = syntheticBars(20, 1);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            kama("slot", bar.close, { length: 5 }),
        );
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => kama("slot", Number.NaN, { length: 5 }).current,
        );
        expect(Number.isFinite(head)).toBe(true);
    });
});
