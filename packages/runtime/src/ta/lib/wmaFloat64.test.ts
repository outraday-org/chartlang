// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { wmaFloat64 } from "./wmaFloat64";

describe("wmaFloat64", () => {
    it("returns an empty output for empty input", () => {
        const out = wmaFloat64(new Float64Array(0), 3);
        expect(out.length).toBe(0);
    });

    it("returns all-NaN for length ≤ 0", () => {
        const out = wmaFloat64(new Float64Array([1, 2, 3]), 0);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("returns all-NaN when the input is shorter than length", () => {
        const out = wmaFloat64(new Float64Array([1, 2]), 5);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("computes the linear-weighted mean against a hand-rolled fixture", () => {
        // length 3, denom = 6, weights (3, 2, 1) over (x[i], x[i-1], x[i-2]).
        const input = new Float64Array([1, 2, 3, 4, 5]);
        const out = wmaFloat64(input, 3);
        expect(Number.isNaN(out[0])).toBe(true);
        expect(Number.isNaN(out[1])).toBe(true);
        // out[2] = (3*3 + 2*2 + 1*1) / 6 = 14/6
        expect(out[2]).toBeCloseTo(14 / 6, 12);
        // out[3] = (3*4 + 2*3 + 1*2) / 6 = 20/6
        expect(out[3]).toBeCloseTo(20 / 6, 12);
        // out[4] = (3*5 + 2*4 + 1*3) / 6 = 26/6
        expect(out[4]).toBeCloseTo(26 / 6, 12);
    });

    it("skips leading NaNs to find the seed", () => {
        const input = new Float64Array([Number.NaN, Number.NaN, 4, 6, 8]);
        const out = wmaFloat64(input, 3);
        expect(Number.isNaN(out[0])).toBe(true);
        expect(Number.isNaN(out[1])).toBe(true);
        expect(Number.isNaN(out[2])).toBe(true);
        expect(Number.isNaN(out[3])).toBe(true);
        // out[4] = (3*8 + 2*6 + 1*4) / 6 = 40/6
        expect(out[4]).toBeCloseTo(40 / 6, 12);
    });

    it("short-circuits a window to NaN if any slot in the window is NaN", () => {
        // Mid-stream NaN at index 3.
        const input = new Float64Array([1, 2, 3, Number.NaN, 5, 6, 7]);
        const out = wmaFloat64(input, 3);
        expect(out[2]).toBeCloseTo(14 / 6, 12);
        expect(Number.isNaN(out[3])).toBe(true);
        expect(Number.isNaN(out[4])).toBe(true);
        expect(Number.isNaN(out[5])).toBe(true);
        // out[6] = (3*7 + 2*6 + 1*5) / 6
        expect(out[6]).toBeCloseTo(38 / 6, 12);
    });

    it("returns all-NaN if no finite values exist", () => {
        const input = new Float64Array([Number.NaN, Number.NaN, Number.NaN]);
        const out = wmaFloat64(input, 2);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });
});
