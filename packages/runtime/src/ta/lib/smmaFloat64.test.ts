// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { smmaFloat64 } from "./smmaFloat64";

describe("smmaFloat64", () => {
    it("returns an empty output for empty input", () => {
        const out = smmaFloat64(new Float64Array(0), 3);
        expect(out.length).toBe(0);
    });

    it("returns all-NaN for length ≤ 0", () => {
        const out = smmaFloat64(new Float64Array([1, 2, 3]), 0);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("returns all-NaN when the input is shorter than length", () => {
        const out = smmaFloat64(new Float64Array([1, 2]), 5);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("seeds with the simple mean of the first length values, then runs the recurrence", () => {
        const input = new Float64Array([1, 2, 3, 4]);
        const out = smmaFloat64(input, 3);
        expect(Number.isNaN(out[0])).toBe(true);
        expect(Number.isNaN(out[1])).toBe(true);
        // seed: mean(1,2,3) = 2
        expect(out[2]).toBeCloseTo(2, 12);
        // out[3] = (out[2] * 2 + 4) / 3 = (4 + 4) / 3
        expect(out[3]).toBeCloseTo(8 / 3, 12);
    });

    it("holds the previous output forward when the value is NaN", () => {
        const input = new Float64Array([1, 2, 3, Number.NaN, 5]);
        const out = smmaFloat64(input, 3);
        expect(out[2]).toBeCloseTo(2, 12);
        expect(out[3]).toBeCloseTo(out[2], 12);
        // out[4] = (out[3] * 2 + 5) / 3 — recurrence continues from held value.
        expect(out[4]).toBeCloseTo((out[3] * 2 + 5) / 3, 12);
    });

    it("skips leading NaNs to seed", () => {
        const input = new Float64Array([Number.NaN, Number.NaN, 4, 6, 8]);
        const out = smmaFloat64(input, 3);
        expect(Number.isNaN(out[3])).toBe(true);
        // seed: mean(4,6,8) = 6 at index 4
        expect(out[4]).toBeCloseTo(6, 12);
    });

    it("returns all-NaN if no finite values exist", () => {
        const input = new Float64Array([Number.NaN, Number.NaN]);
        const out = smmaFloat64(input, 2);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });
});
