// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { computeEmaOfFloat64 } from "./emaFloat64.js";

describe("computeEmaOfFloat64", () => {
    it("returns an empty output for empty input", () => {
        const out = computeEmaOfFloat64(new Float64Array(0), 3);
        expect(out.length).toBe(0);
    });

    it("returns an all-NaN buffer for length ≤ 0", () => {
        const out = computeEmaOfFloat64(new Float64Array([1, 2, 3]), 0);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("returns all-NaN when the input is shorter than length", () => {
        const out = computeEmaOfFloat64(new Float64Array([1, 2]), 5);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("seeds with the simple mean of the first length values", () => {
        const out = computeEmaOfFloat64(new Float64Array([1, 2, 3]), 3);
        expect(Number.isNaN(out[0])).toBe(true);
        expect(Number.isNaN(out[1])).toBe(true);
        expect(out[2]).toBeCloseTo(2, 12);
    });

    it("applies the EMA recurrence after the seed", () => {
        const input = new Float64Array([1, 2, 3, 4]);
        const out = computeEmaOfFloat64(input, 3);
        const k = 2 / 4;
        const expected = 4 * k + out[2] * (1 - k);
        expect(out[3]).toBeCloseTo(expected, 12);
    });

    it("holds the previous output forward when the value is NaN", () => {
        const input = new Float64Array([1, 2, 3, Number.NaN, 5]);
        const out = computeEmaOfFloat64(input, 3);
        expect(out[3]).toBeCloseTo(out[2], 12);
    });

    it("skips leading NaNs to seed", () => {
        const input = new Float64Array([Number.NaN, Number.NaN, 4, 6, 8]);
        const out = computeEmaOfFloat64(input, 3);
        expect(Number.isNaN(out[3])).toBe(true);
        expect(out[4]).toBeCloseTo(6, 12);
    });

    it("returns all-NaN if no finite values exist", () => {
        const input = new Float64Array([Number.NaN, Number.NaN]);
        const out = computeEmaOfFloat64(input, 2);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });
});
