// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { adx } from "./adx";
import { adxFromDi } from "./lib/adxFromDi";
import { wilderDirectional } from "./lib/wilderDirectional";
import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";

describe("ta.adx", () => {
    it("matches the reference adxFromDi(wilderDirectional(...)) over 80 bars × length=14, smoothing=14", () => {
        const bars = syntheticBars(80, 19);
        const highs = new Float64Array(bars.map((b) => b.high));
        const lows = new Float64Array(bars.map((b) => b.low));
        const closes = new Float64Array(bars.map((b) => b.close));
        const { plusDi, minusDi } = wilderDirectional(highs, lows, closes, 14);
        const expected = adxFromDi(plusDi, minusDi, 14);
        const actual = harness(bars, bars.length + 1, () => adx("slot", 14).current);
        for (let i = 0; i < bars.length; i += 1) {
            if (Number.isNaN(expected[i])) {
                expect(Number.isNaN(actual[i])).toBe(true);
            } else {
                expect(actual[i]).toBeCloseTo(expected[i], 10);
            }
        }
    });

    it("emits NaN until `length + smoothing - 1` bars; first defined at `length + smoothing`", () => {
        const bars = syntheticBars(30, 5);
        // length=5, smoothing=5 → warmup 9; first defined at index 9.
        const out = harness(bars, bars.length + 1, () => adx("slot", 5, { smoothing: 5 }).current);
        for (let i = 0; i < 9; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[9])).toBe(true);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(20, 3);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            ids.add(adx("slot", 5));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("defaults smoothing to 14 when omitted", () => {
        const bars = syntheticBars(40, 7);
        const a = harness(bars, bars.length + 1, () => adx("slot", 14).current);
        const b = harness(bars, bars.length + 1, () => adx("slot", 14, { smoothing: 14 }).current);
        for (let i = 0; i < bars.length; i += 1) {
            if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
            else expect(a[i]).toBe(b[i]);
        }
    });

    it("ADX is 0 for a flat-DI (constant-bar) input — DX is zero", () => {
        const bars = Array.from({ length: 30 }, (_, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: 100,
            high: 100,
            low: 100,
            close: 100,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, () => adx("slot", 5, { smoothing: 5 }).current);
        // length=5, smoothing=5 → first defined at index 9.
        expect(out[9]).toBe(0);
        expect(out[10]).toBe(0);
    });

    it("throws when called outside an active script step", () => {
        expect(() => adx("oops", 5)).toThrowError(/ta.adx called outside an active script step/);
    });

    it("holds prior values forward on a NaN bar", () => {
        const bars = syntheticBars(40, 11);
        bars[25] = { ...bars[25], high: Number.NaN, low: Number.NaN, close: Number.NaN };
        const out = harness(bars, bars.length + 1, () => adx("slot", 5, { smoothing: 5 }).current);
        expect(Number.isFinite(out[24])).toBe(true);
        // NaN inputs keep prior adx (DI recurrence holds forward).
        expect(out[25]).toBe(out[24]);
    });

    it("opts.offset returns the value `offset` bars ago", () => {
        const bars = syntheticBars(40, 13);
        const unshifted = harness(
            bars,
            bars.length + 1,
            () => adx("slot", 5, { smoothing: 5 }).current,
        );
        const shifted = harness(
            bars,
            bars.length + 1,
            () => adx("slot", 5, { smoothing: 5, offset: 3 }).current,
        );
        for (let k = 3; k < bars.length; k += 1) {
            const u = unshifted[k - 3];
            const s = shifted[k];
            if (Number.isNaN(u)) expect(Number.isNaN(s)).toBe(true);
            else expect(s).toBeCloseTo(u, 12);
        }
    });
});

describe("ta.adx tick-mode", () => {
    it("replaces the head without advancing the buffer", () => {
        const bars = syntheticBars(30, 5);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            adx("slot", 5, { smoothing: 5 }),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, high: last.high + 1, low: last.low - 1 }, () =>
            adx("slot", 5, { smoothing: 5 }),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(40, 17);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            adx("slot", 5, { smoothing: 5 }),
        );
        const last = bars[bars.length - 1];
        const tickBar = { ...last, high: last.high + 0.3, low: last.low - 0.3 };
        const a = tick(ctxRef, tickBar, () => adx("slot", 5, { smoothing: 5 }).current);
        const b = tick(ctxRef, tickBar, () => adx("slot", 5, { smoothing: 5 }).current);
        expect(b).toBeCloseTo(a, 10);
    });

    it("tick during ADX seed window returns NaN", () => {
        const bars = syntheticBars(5, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () =>
            adx("slot", 5, { smoothing: 5 }),
        );
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => adx("slot", 5, { smoothing: 5 }).current,
        );
        expect(Number.isNaN(head)).toBe(true);
    });
});
