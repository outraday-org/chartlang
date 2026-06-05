// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { wilderDirectional } from "./wilderDirectional";

function expectAllNaN(out: {
    plusDm: Float64Array;
    minusDm: Float64Array;
    plusDi: Float64Array;
    minusDi: Float64Array;
}) {
    for (const arr of [out.plusDm, out.minusDm, out.plusDi, out.minusDi]) {
        for (const v of arr) expect(Number.isNaN(v)).toBe(true);
    }
}

describe("wilderDirectional", () => {
    it("returns all-NaN buffers for empty input", () => {
        const out = wilderDirectional(
            new Float64Array(0),
            new Float64Array(0),
            new Float64Array(0),
            14,
        );
        expect(out.plusDm.length).toBe(0);
        expect(out.minusDm.length).toBe(0);
        expect(out.plusDi.length).toBe(0);
        expect(out.minusDi.length).toBe(0);
    });

    it("returns all-NaN buffers for length ≤ 0", () => {
        const h = new Float64Array([1, 2, 3, 4]);
        const l = new Float64Array([0, 1, 2, 3]);
        const c = new Float64Array([0.5, 1.5, 2.5, 3.5]);
        expectAllNaN(wilderDirectional(h, l, c, 0));
    });

    it("returns all-NaN buffers when n ≤ length", () => {
        const h = new Float64Array([1, 2, 3]);
        const l = new Float64Array([0, 1, 2]);
        const c = new Float64Array([0.5, 1.5, 2.5]);
        expectAllNaN(wilderDirectional(h, l, c, 3));
    });

    it("returns all-NaN buffers when low.length !== high.length", () => {
        const h = new Float64Array([1, 2, 3, 4]);
        const l = new Float64Array([0, 1, 2]);
        const c = new Float64Array([0.5, 1.5, 2.5, 3.5]);
        expectAllNaN(wilderDirectional(h, l, c, 2));
    });

    it("returns all-NaN buffers when close.length !== high.length", () => {
        const h = new Float64Array([1, 2, 3, 4]);
        const l = new Float64Array([0, 1, 2, 3]);
        const c = new Float64Array([0.5, 1.5]);
        expectAllNaN(wilderDirectional(h, l, c, 2));
    });

    it("warmup slots [0, length-1] are NaN", () => {
        const n = 10;
        const h = new Float64Array(n);
        const l = new Float64Array(n);
        const c = new Float64Array(n);
        for (let i = 0; i < n; i += 1) {
            h[i] = 100 + i;
            l[i] = 99 + i;
            c[i] = 99.5 + i;
        }
        const length = 3;
        const out = wilderDirectional(h, l, c, length);
        for (let i = 0; i < length; i += 1) {
            expect(Number.isNaN(out.plusDm[i])).toBe(true);
            expect(Number.isNaN(out.minusDm[i])).toBe(true);
            expect(Number.isNaN(out.plusDi[i])).toBe(true);
            expect(Number.isNaN(out.minusDi[i])).toBe(true);
        }
        expect(Number.isFinite(out.plusDi[length])).toBe(true);
    });

    it("matches a hand-computed reference for a 6-bar uptrend, length=3", () => {
        // upMove > 0 every bar, downMove ≤ 0 -> plusDm sequence carries
        // the up amounts; minusDm all zero. TR equals (h - l) on bar 0
        // and (h - prevClose) thereafter (uptrend).
        const h = new Float64Array([10, 11, 12, 13, 14, 15]);
        const l = new Float64Array([9, 10, 11, 12, 13, 14]);
        const c = new Float64Array([9.5, 10.5, 11.5, 12.5, 13.5, 14.5]);
        const length = 3;
        const out = wilderDirectional(h, l, c, length);

        // Bars 1..3 raw: each up=1, down=-1 -> plusDm=1, minusDm=0.
        // TR bar 0 = 1; TR bars 1..3 = max(h-l, h-prevC, l-prevC)
        //   = max(1, 11-9.5=1.5, 10-9.5=0.5) = 1.5 etc.
        // seedPlusDm = 3, seedMinusDm = 0, seedTr = 1 + 1.5*3 = 5.5
        // plusDm[3] = seedPlusDm / length = 1
        // minusDm[3] = 0
        // plusDi[3] = 100 * 3 / 5.5 = 54.545...
        // minusDi[3] = 0
        expect(out.plusDm[3]).toBeCloseTo(1, 12);
        expect(out.minusDm[3]).toBeCloseTo(0, 12);
        expect(out.plusDi[3]).toBeCloseTo((100 * 3) / 5.5, 10);
        expect(out.minusDi[3]).toBeCloseTo(0, 12);
    });

    it("plusDi / minusDi fall back to 0 when smoothed TR is 0", () => {
        // Construct a flat series: TR ≡ 0 across the seed window.
        const n = 6;
        const h = new Float64Array(n).fill(10);
        const l = new Float64Array(n).fill(10);
        const c = new Float64Array(n).fill(10);
        const out = wilderDirectional(h, l, c, 3);
        expect(out.plusDi[3]).toBe(0);
        expect(out.minusDi[3]).toBe(0);
        // The recurrence holds zero TR forward -> still 0.
        expect(out.plusDi[4]).toBe(0);
        expect(out.minusDi[4]).toBe(0);
    });

    it("NaN inside the seed window leaves all outputs NaN", () => {
        const h = new Float64Array([10, 11, Number.NaN, 13, 14, 15]);
        const l = new Float64Array([9, 10, 11, 12, 13, 14]);
        const c = new Float64Array([9.5, 10.5, 11.5, 12.5, 13.5, 14.5]);
        const out = wilderDirectional(h, l, c, 3);
        for (const arr of [out.plusDm, out.minusDm, out.plusDi, out.minusDi]) {
            for (const v of arr) expect(Number.isNaN(v)).toBe(true);
        }
    });

    it("NaN after the seed window halts forward emission", () => {
        const h = new Float64Array([10, 11, 12, 13, Number.NaN, 15]);
        const l = new Float64Array([9, 10, 11, 12, 13, 14]);
        const c = new Float64Array([9.5, 10.5, 11.5, 12.5, 13.5, 14.5]);
        const out = wilderDirectional(h, l, c, 3);
        // Seed slot index 3 is valid (seed window 1..3 finite).
        expect(Number.isFinite(out.plusDi[3])).toBe(true);
        // Slot 4 sees NaN at high[4] -> NaN, and the loop returns.
        expect(Number.isNaN(out.plusDi[4])).toBe(true);
        expect(Number.isNaN(out.plusDi[5])).toBe(true);
    });

    it("downtrend produces minusDm > 0 and plusDm = 0", () => {
        const h = new Float64Array([15, 14, 13, 12, 11, 10]);
        const l = new Float64Array([14, 13, 12, 11, 10, 9]);
        const c = new Float64Array([14.5, 13.5, 12.5, 11.5, 10.5, 9.5]);
        const out = wilderDirectional(h, l, c, 3);
        expect(out.minusDm[3]).toBeGreaterThan(0);
        expect(out.plusDm[3]).toBe(0);
        expect(out.minusDi[3]).toBeGreaterThan(0);
        expect(out.plusDi[3]).toBe(0);
    });

    it("propagates NaN at bar 0 (initial TR) when high[0] is NaN", () => {
        const h = new Float64Array([Number.NaN, 11, 12, 13, 14, 15]);
        const l = new Float64Array([9, 10, 11, 12, 13, 14]);
        const c = new Float64Array([9.5, 10.5, 11.5, 12.5, 13.5, 14.5]);
        const out = wilderDirectional(h, l, c, 3);
        for (const arr of [out.plusDm, out.minusDm, out.plusDi, out.minusDi]) {
            for (const v of arr) expect(Number.isNaN(v)).toBe(true);
        }
    });
});
