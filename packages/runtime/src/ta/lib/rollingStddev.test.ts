// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { computeRollingStdDev } from "./rollingStddev";

describe("computeRollingStdDev", () => {
    it("returns an all-NaN buffer for length ≤ 0", () => {
        const out = computeRollingStdDev(new Float64Array([1, 2, 3]), 0);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("returns an all-NaN buffer for empty input", () => {
        expect(computeRollingStdDev(new Float64Array(0), 3).length).toBe(0);
    });

    it("returns all-NaN when biased=false and length === 1", () => {
        const out = computeRollingStdDev(new Float64Array([1, 2, 3]), 1, false);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("computes population stddev by default", () => {
        const input = new Float64Array([2, 4, 4, 4, 5, 5, 7, 9]);
        const out = computeRollingStdDev(input, 4);
        expect(Number.isNaN(out[2])).toBe(true);
        const window = [2, 4, 4, 4];
        const mean = window.reduce((a, b) => a + b, 0) / 4;
        const sumSq = window.reduce((a, b) => a + (b - mean) ** 2, 0);
        expect(out[3]).toBeCloseTo(Math.sqrt(sumSq / 4), 12);
    });

    it("computes sample stddev when biased=false", () => {
        const input = new Float64Array([2, 4, 4, 4]);
        const out = computeRollingStdDev(input, 4, false);
        const mean = (2 + 4 + 4 + 4) / 4;
        const sumSq = (2 - mean) ** 2 + 3 * (4 - mean) ** 2;
        expect(out[3]).toBeCloseTo(Math.sqrt(sumSq / 3), 12);
    });

    it("emits NaN if any value in the window is NaN", () => {
        const input = new Float64Array([1, 2, Number.NaN, 4, 5]);
        const out = computeRollingStdDev(input, 3);
        expect(Number.isNaN(out[2])).toBe(true);
        expect(Number.isNaN(out[3])).toBe(true);
        expect(Number.isFinite(out[4])).toBe(false);
    });
});
