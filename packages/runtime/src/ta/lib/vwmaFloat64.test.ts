// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { vwmaFloat64 } from "./vwmaFloat64";

describe("vwmaFloat64", () => {
    it("returns an empty output for empty input", () => {
        const out = vwmaFloat64(new Float64Array(0), new Float64Array(0), 3);
        expect(out.length).toBe(0);
    });

    it("returns all-NaN for length ≤ 0", () => {
        const out = vwmaFloat64(new Float64Array([1, 2, 3]), new Float64Array([1, 1, 1]), 0);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("returns all-NaN when the input is shorter than length", () => {
        const out = vwmaFloat64(new Float64Array([1, 2]), new Float64Array([1, 1]), 5);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("returns all-NaN when source and volume lengths disagree", () => {
        const out = vwmaFloat64(new Float64Array([1, 2, 3]), new Float64Array([1, 1]), 2);
        expect(out.length).toBe(3);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("computes the volume-weighted mean against a hand-rolled fixture", () => {
        const src = new Float64Array([10, 20, 30, 40, 50]);
        const vol = new Float64Array([1, 2, 3, 4, 5]);
        const out = vwmaFloat64(src, vol, 3);
        expect(Number.isNaN(out[0])).toBe(true);
        expect(Number.isNaN(out[1])).toBe(true);
        // out[2] = (10*1 + 20*2 + 30*3) / (1+2+3) = 140/6
        expect(out[2]).toBeCloseTo(140 / 6, 12);
        // out[3] = (20*2 + 30*3 + 40*4) / (2+3+4) = 290/9
        expect(out[3]).toBeCloseTo(290 / 9, 12);
        // out[4] = (30*3 + 40*4 + 50*5) / (3+4+5) = 500/12
        expect(out[4]).toBeCloseTo(500 / 12, 12);
    });

    it("skips leading NaN source slots to find the seed", () => {
        const src = new Float64Array([Number.NaN, Number.NaN, 4, 6, 8]);
        const vol = new Float64Array([1, 1, 1, 2, 3]);
        const out = vwmaFloat64(src, vol, 3);
        expect(Number.isNaN(out[3])).toBe(true);
        // out[4] = (4*1 + 6*2 + 8*3) / (1+2+3) = 40/6
        expect(out[4]).toBeCloseTo(40 / 6, 12);
    });

    it("short-circuits a window to NaN if any source slot is NaN", () => {
        const src = new Float64Array([1, 2, 3, Number.NaN, 5, 6, 7]);
        const vol = new Float64Array([1, 1, 1, 1, 1, 1, 1]);
        const out = vwmaFloat64(src, vol, 3);
        expect(out[2]).toBeCloseTo((1 + 2 + 3) / 3, 12);
        expect(Number.isNaN(out[3])).toBe(true);
        expect(Number.isNaN(out[4])).toBe(true);
        expect(Number.isNaN(out[5])).toBe(true);
        expect(out[6]).toBeCloseTo((5 + 6 + 7) / 3, 12);
    });

    it("returns NaN for a window whose total volume is zero", () => {
        const src = new Float64Array([1, 2, 3, 4]);
        const vol = new Float64Array([0, 0, 0, 0]);
        const out = vwmaFloat64(src, vol, 3);
        expect(Number.isNaN(out[2])).toBe(true);
        expect(Number.isNaN(out[3])).toBe(true);
    });

    it("treats NaN volume as zero (matches invinite's volume ?? 0)", () => {
        const src = new Float64Array([10, 20, 30]);
        const vol = new Float64Array([1, Number.NaN, 1]);
        const out = vwmaFloat64(src, vol, 3);
        // (10*1 + 20*0 + 30*1) / (1+0+1) = 40/2 = 20
        expect(out[2]).toBeCloseTo(20, 12);
    });

    it("returns all-NaN if no finite source values exist", () => {
        const src = new Float64Array([Number.NaN, Number.NaN, Number.NaN]);
        const vol = new Float64Array([1, 1, 1]);
        const out = vwmaFloat64(src, vol, 2);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });
});
