// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { linearRegression } from "./linearRegression.js";

describe("linearRegression", () => {
    it("returns all-NaN outputs for length < 2", () => {
        const out = linearRegression(new Float64Array([1, 2, 3]), 1);
        for (const v of out.slope) expect(Number.isNaN(v)).toBe(true);
        for (const v of out.intercept) expect(Number.isNaN(v)).toBe(true);
        for (const v of out.value) expect(Number.isNaN(v)).toBe(true);
    });

    it("returns empty outputs for empty input", () => {
        const out = linearRegression(new Float64Array(0), 3);
        expect(out.slope.length).toBe(0);
        expect(out.intercept.length).toBe(0);
        expect(out.value.length).toBe(0);
    });

    it("returns all-NaN outputs when n < length", () => {
        const out = linearRegression(new Float64Array([1, 2]), 5);
        for (const v of out.slope) expect(Number.isNaN(v)).toBe(true);
    });

    it("yields slope = 0 over a constant window", () => {
        const out = linearRegression(new Float64Array([5, 5, 5, 5]), 4);
        expect(out.slope[3]).toBe(0);
        expect(out.intercept[3]).toBeCloseTo(5, 12);
        expect(out.value[3]).toBeCloseTo(5, 12);
    });

    it("matches a hand-rolled linear fixture y = 2x + 1", () => {
        // y = [1, 3, 5, 7] -> slope=2, intercept=1, value=1+2*3=7
        const out = linearRegression(new Float64Array([1, 3, 5, 7]), 4);
        expect(Number.isNaN(out.slope[0])).toBe(true);
        expect(Number.isNaN(out.slope[1])).toBe(true);
        expect(Number.isNaN(out.slope[2])).toBe(true);
        expect(out.slope[3]).toBeCloseTo(2, 12);
        expect(out.intercept[3]).toBeCloseTo(1, 12);
        expect(out.value[3]).toBeCloseTo(7, 12);
    });

    it("computes a rolling fit over a longer series", () => {
        // y = [1, 3, 5, 7, 9] with length=3.
        // Window at i=2: [1,3,5] -> slope=2, intercept=1, value=5.
        // Window at i=3: [3,5,7] -> slope=2, intercept=3, value=7.
        // Window at i=4: [5,7,9] -> slope=2, intercept=5, value=9.
        const out = linearRegression(new Float64Array([1, 3, 5, 7, 9]), 3);
        expect(out.slope[2]).toBeCloseTo(2, 12);
        expect(out.intercept[2]).toBeCloseTo(1, 12);
        expect(out.value[2]).toBeCloseTo(5, 12);
        expect(out.slope[3]).toBeCloseTo(2, 12);
        expect(out.intercept[3]).toBeCloseTo(3, 12);
        expect(out.value[3]).toBeCloseTo(7, 12);
        expect(out.slope[4]).toBeCloseTo(2, 12);
        expect(out.intercept[4]).toBeCloseTo(5, 12);
        expect(out.value[4]).toBeCloseTo(9, 12);
    });

    it("propagates NaN at the affected slot only", () => {
        // length=3. Slot 2 sees window [1, 3, NaN] -> NaN.
        // Slot 3 sees window [3, NaN, 7] -> NaN.
        // Slot 4 sees window [NaN, 7, 9] -> NaN.
        // Slot 5 sees window [7, 9, 11] -> defined.
        const out = linearRegression(new Float64Array([1, 3, Number.NaN, 7, 9, 11]), 3);
        expect(Number.isNaN(out.slope[2])).toBe(true);
        expect(Number.isNaN(out.slope[3])).toBe(true);
        expect(Number.isNaN(out.slope[4])).toBe(true);
        expect(out.slope[5]).toBeCloseTo(2, 12);
        expect(out.intercept[5]).toBeCloseTo(7, 12);
        expect(out.value[5]).toBeCloseTo(11, 12);
    });
});
