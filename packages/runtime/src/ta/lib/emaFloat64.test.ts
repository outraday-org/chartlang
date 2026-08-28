// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { computeEmaOfFloat64 } from "./emaFloat64.js";

describe("computeEmaOfFloat64", () => {
    it("returns an empty output for empty input", () => {
        const out = computeEmaOfFloat64(new Float64Array(0), 3);
        expect(out.length).toBe(0);
    });

    it.each([0, -1, 1.5, Number.NaN])("returns all-NaN for invalid length %s", (length) => {
        const out = computeEmaOfFloat64(new Float64Array([1, 2, 3]), length);
        for (const value of out) expect(Number.isNaN(value)).toBe(true);
    });

    it("seeds immediately even when the input is shorter than length", () => {
        const out = computeEmaOfFloat64(new Float64Array([1, 2]), 5);
        expect(out[0]).toBe(1);
        expect(out[1]).toBeCloseTo(4 / 3, 15);
    });

    it("seeds with the first usable value and applies the recurrence immediately", () => {
        const out = computeEmaOfFloat64(new Float64Array([1, 2, 3]), 3);
        expect(Array.from(out)).toEqual([1, 1.5, 2.25]);
    });

    it("applies the EMA recurrence after the seed", () => {
        const input = new Float64Array([1, 2, 3, 4]);
        const out = computeEmaOfFloat64(input, 3);
        const k = 2 / 4;
        const expected = 4 * k + out[2] * (1 - k);
        expect(out[3]).toBeCloseTo(expected, 12);
    });

    it("emits NaN for a gap and resumes from the last finite EMA", () => {
        const input = new Float64Array([1, 2, 3, Number.NaN, 5]);
        const out = computeEmaOfFloat64(input, 3);
        expect(Number.isNaN(out[3])).toBe(true);
        expect(out[4]).toBeCloseTo(5 * 0.5 + out[2] * 0.5, 12);
    });

    it("keeps leading NaNs and seeds on the first usable value", () => {
        const input = new Float64Array([Number.NaN, Number.NaN, 4, Number.NaN, 8]);
        const out = computeEmaOfFloat64(input, 3);
        expect(Number.isNaN(out[0])).toBe(true);
        expect(Number.isNaN(out[1])).toBe(true);
        expect(out[2]).toBe(4);
        expect(Number.isNaN(out[3])).toBe(true);
        expect(out[4]).toBe(6);
    });

    it("length 1 is the finite source with NaN gaps preserved", () => {
        const out = computeEmaOfFloat64(new Float64Array([1, Number.NaN, 3, 4]), 1);
        expect(out[0]).toBe(1);
        expect(Number.isNaN(out[1])).toBe(true);
        expect(out[2]).toBe(3);
        expect(out[3]).toBe(4);
    });

    it("returns all-NaN if no finite values exist", () => {
        const input = new Float64Array([Number.NaN, Number.NaN]);
        const out = computeEmaOfFloat64(input, 2);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });
});
