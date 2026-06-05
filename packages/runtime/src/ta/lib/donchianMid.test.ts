// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { donchianMid } from "./donchianMid";

describe("donchianMid", () => {
    it("returns an all-NaN buffer for length ≤ 0", () => {
        const out = donchianMid(new Float64Array([1, 2, 3]), new Float64Array([1, 2, 3]), 0);
        expect(out.length).toBe(3);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("returns an all-NaN buffer for length > n", () => {
        const out = donchianMid(new Float64Array([1, 2]), new Float64Array([1, 2]), 5);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("returns an empty buffer for empty input", () => {
        const out = donchianMid(new Float64Array(0), new Float64Array(0), 3);
        expect(out.length).toBe(0);
    });

    it("returns an all-NaN buffer when high.length !== low.length", () => {
        const out = donchianMid(new Float64Array([1, 2, 3]), new Float64Array([1, 2]), 2);
        expect(out.length).toBe(3);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("computes the midpoint over a hand-rolled fixture", () => {
        const high = new Float64Array([10, 12, 11, 14, 13]);
        const low = new Float64Array([8, 9, 7, 10, 11]);
        const out = donchianMid(high, low, 3);
        expect(Number.isNaN(out[0])).toBe(true);
        expect(Number.isNaN(out[1])).toBe(true);
        // window [10,12,11] / [8,9,7] -> (12 + 7) / 2 = 9.5
        expect(out[2]).toBeCloseTo(9.5, 12);
        // window [12,11,14] / [9,7,10] -> (14 + 7) / 2 = 10.5
        expect(out[3]).toBeCloseTo(10.5, 12);
        // window [11,14,13] / [7,10,11] -> (14 + 7) / 2 = 10.5
        expect(out[4]).toBeCloseTo(10.5, 12);
    });

    it("propagates NaN when a window slot is non-finite", () => {
        const high = new Float64Array([10, Number.NaN, 11, 14]);
        const low = new Float64Array([8, 9, 7, 10]);
        const out = donchianMid(high, low, 3);
        // first valid slot index 2: window contains NaN at index 1 -> NaN
        expect(Number.isNaN(out[2])).toBe(true);
        // slot index 3: window [NaN, 11, 14] / [9, 7, 10] -> NaN
        expect(Number.isNaN(out[3])).toBe(true);
    });

    it("propagates NaN when the trailing slot itself is non-finite", () => {
        const high = new Float64Array([10, 12, Number.NaN, 14]);
        const low = new Float64Array([8, 9, 7, 10]);
        const out = donchianMid(high, low, 3);
        expect(Number.isNaN(out[2])).toBe(true);
    });

    it("propagates NaN when a low slot is non-finite", () => {
        const high = new Float64Array([10, 12, 11, 14]);
        const low = new Float64Array([8, 9, Number.NaN, 10]);
        const out = donchianMid(high, low, 3);
        expect(Number.isNaN(out[2])).toBe(true);
    });
});
