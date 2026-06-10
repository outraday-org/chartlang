// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { computeSmaOfFloat64 } from "./smaFloat64.js";

describe("computeSmaOfFloat64", () => {
    it("returns an all-NaN buffer for empty input", () => {
        const out = computeSmaOfFloat64(new Float64Array(0), 3);
        expect(out.length).toBe(0);
    });

    it("returns an all-NaN buffer for length ≤ 0", () => {
        const out = computeSmaOfFloat64(new Float64Array([1, 2, 3]), 0);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("returns an all-NaN buffer when the input is too short for the window", () => {
        const out = computeSmaOfFloat64(new Float64Array([1, 2]), 5);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("NaN warmup of length-1 bars then rolling mean", () => {
        const input = new Float64Array([1, 2, 3, 4, 5]);
        const out = computeSmaOfFloat64(input, 3);
        expect(Number.isNaN(out[0])).toBe(true);
        expect(Number.isNaN(out[1])).toBe(true);
        expect(out[2]).toBeCloseTo(2, 12);
        expect(out[3]).toBeCloseTo(3, 12);
        expect(out[4]).toBeCloseTo(4, 12);
    });

    it("skips leading NaNs to find the seed", () => {
        const input = new Float64Array([Number.NaN, Number.NaN, 4, 6, 8]);
        const out = computeSmaOfFloat64(input, 3);
        expect(Number.isNaN(out[3])).toBe(true);
        expect(out[4]).toBeCloseTo(6, 12);
    });

    it("holds the previous output forward at the bar where the NaN appears", () => {
        // out[3] = NaN-window → hold out[2]=2.
        // out[4] = window is [3, NaN, 5] (still NaN in window) → hold out[3]=2.
        // out[5] = window is [NaN, 5, 6] (still NaN) → hold out[4]=2.
        // out[6] = window is [5, 6, 7] (all finite again, BUT the running
        // sum carried the NaN through arithmetic — running sum stays NaN so
        // the fallback path continues holding the prev value).
        const input = new Float64Array([1, 2, 3, Number.NaN, 5, 6, 7]);
        const out = computeSmaOfFloat64(input, 3);
        expect(out[2]).toBeCloseTo(2, 12);
        expect(out[3]).toBeCloseTo(2, 12);
    });

    it("returns all-NaN if no finite values exist", () => {
        const input = new Float64Array([Number.NaN, Number.NaN, Number.NaN]);
        const out = computeSmaOfFloat64(input, 2);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });
});
