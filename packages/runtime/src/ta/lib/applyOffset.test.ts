// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { applyOffsetToSeries } from "./applyOffset";

describe("applyOffsetToSeries", () => {
    it("returns the same reference when offset is 0", () => {
        const v = new Float64Array([1, 2, 3]);
        expect(applyOffsetToSeries(v, 0)).toBe(v);
    });

    it("returns the same reference for an empty input", () => {
        const v = new Float64Array(0);
        expect(applyOffsetToSeries(v, 3)).toBe(v);
    });

    it("shifts forward by N (positive offset)", () => {
        const v = new Float64Array([1, 2, 3, 4, 5]);
        const out = applyOffsetToSeries(v, 2);
        expect(Number.isNaN(out[0])).toBe(true);
        expect(Number.isNaN(out[1])).toBe(true);
        expect(out[2]).toBe(1);
        expect(out[3]).toBe(2);
        expect(out[4]).toBe(3);
    });

    it("shifts backward by N (negative offset)", () => {
        const v = new Float64Array([1, 2, 3, 4, 5]);
        const out = applyOffsetToSeries(v, -2);
        expect(out[0]).toBe(3);
        expect(out[1]).toBe(4);
        expect(out[2]).toBe(5);
        expect(Number.isNaN(out[3])).toBe(true);
        expect(Number.isNaN(out[4])).toBe(true);
    });

    it("returns an all-NaN array when offset exceeds the input length", () => {
        const v = new Float64Array([1, 2, 3]);
        const out = applyOffsetToSeries(v, 10);
        expect(out.length).toBe(3);
        for (let i = 0; i < out.length; i += 1) expect(Number.isNaN(out[i])).toBe(true);
    });
});
