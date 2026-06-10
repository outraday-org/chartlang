// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { pearson } from "./pearson.js";

describe("pearson", () => {
    it("returns all-NaN for length < 2", () => {
        const out = pearson(new Float64Array([1, 2, 3]), new Float64Array([1, 2, 3]), 1);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("returns empty for empty input", () => {
        const out = pearson(new Float64Array(0), new Float64Array(0), 3);
        expect(out.length).toBe(0);
    });

    it("returns all-NaN when a.length !== b.length", () => {
        const out = pearson(new Float64Array([1, 2, 3]), new Float64Array([1, 2]), 2);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("returns all-NaN when n < length", () => {
        const out = pearson(new Float64Array([1, 2]), new Float64Array([1, 2]), 5);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("identical series correlate at +1", () => {
        const series = new Float64Array([1, 2, 3, 4, 5]);
        const out = pearson(series, series, 5);
        expect(out[4]).toBeCloseTo(1, 12);
    });

    it("perfectly anti-correlated series correlate at -1", () => {
        const a = new Float64Array([1, 2, 3, 4, 5]);
        const c = new Float64Array([5, 4, 3, 2, 1]);
        const out = pearson(a, c, 5);
        expect(out[4]).toBeCloseTo(-1, 12);
    });

    it("returns NaN when a is constant (zero variance on a)", () => {
        const a = new Float64Array([3, 3, 3, 3]);
        const b = new Float64Array([1, 2, 3, 4]);
        const out = pearson(a, b, 4);
        expect(Number.isNaN(out[3])).toBe(true);
    });

    it("returns NaN when b is constant (zero variance on b)", () => {
        const a = new Float64Array([1, 2, 3, 4]);
        const b = new Float64Array([5, 5, 5, 5]);
        const out = pearson(a, b, 4);
        expect(Number.isNaN(out[3])).toBe(true);
    });

    it("propagates NaN at the affected slot only", () => {
        const a = new Float64Array([1, 2, Number.NaN, 4, 5, 6]);
        const b = new Float64Array([2, 4, 6, 8, 10, 12]);
        const out = pearson(a, b, 3);
        // window at i=2 has NaN
        expect(Number.isNaN(out[2])).toBe(true);
        // window at i=3 has NaN
        expect(Number.isNaN(out[3])).toBe(true);
        // window at i=4 has NaN
        expect(Number.isNaN(out[4])).toBe(true);
        // window at i=5: [4,5,6] vs [8,10,12] -> perfect +1
        expect(out[5]).toBeCloseTo(1, 12);
    });

    it("propagates NaN from b at the affected slot", () => {
        const a = new Float64Array([1, 2, 3, 4]);
        const b = new Float64Array([2, Number.NaN, 6, 8]);
        const out = pearson(a, b, 2);
        // window at i=1 has NaN -> NaN
        expect(Number.isNaN(out[1])).toBe(true);
        // window at i=2 has NaN -> NaN
        expect(Number.isNaN(out[2])).toBe(true);
        // window at i=3 [3,4] vs [6,8]: r = 1
        expect(out[3]).toBeCloseTo(1, 12);
    });

    it("clamps overshoot at +1 / -1", () => {
        // Floating-point can produce r slightly > 1; identical series
        // exercises this path most cleanly — the clamp keeps r ≤ 1.
        const a = new Float64Array([1.000_000_000_1, 2, 3, 4]);
        const out = pearson(a, a, 4);
        expect(out[3]).toBeLessThanOrEqual(1);
        expect(out[3]).toBeGreaterThanOrEqual(-1);
    });

    it("warmup [0, length - 2] is NaN", () => {
        const a = new Float64Array([1, 2, 3, 4, 5]);
        const b = new Float64Array([2, 4, 6, 8, 10]);
        const out = pearson(a, b, 3);
        expect(Number.isNaN(out[0])).toBe(true);
        expect(Number.isNaN(out[1])).toBe(true);
        expect(out[2]).toBeCloseTo(1, 12);
    });
});
