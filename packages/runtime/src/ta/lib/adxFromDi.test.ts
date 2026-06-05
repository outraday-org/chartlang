// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { adxFromDi } from "./adxFromDi";

describe("adxFromDi", () => {
    it("returns an all-NaN buffer for length ≤ 0", () => {
        const out = adxFromDi(new Float64Array([1, 2, 3]), new Float64Array([1, 2, 3]), 0);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("returns an empty buffer for empty input", () => {
        const out = adxFromDi(new Float64Array(0), new Float64Array(0), 3);
        expect(out.length).toBe(0);
    });

    it("returns an all-NaN buffer when plusDi.length !== minusDi.length", () => {
        const out = adxFromDi(new Float64Array([1, 2, 3]), new Float64Array([1, 2]), 1);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("returns an all-NaN buffer when n < 2*length", () => {
        const out = adxFromDi(new Float64Array([1, 2, 3]), new Float64Array([1, 2, 3]), 2);
        // n=3, 2*length=4 -> all NaN
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("DX falls back to 0 when both DIs are zero", () => {
        // length=2 -> 2*length-1 = 3, so first seed at index 3.
        // Need 4 slots; DI valid from index 2 onward (NaN warmup at [0, 1]).
        const plusDi = new Float64Array([Number.NaN, Number.NaN, 0, 0]);
        const minusDi = new Float64Array([Number.NaN, Number.NaN, 0, 0]);
        const out = adxFromDi(plusDi, minusDi, 2);
        // dx[2] = 0, dx[3] = 0 -> seed = (0 + 0) / 2 = 0
        expect(out[3]).toBe(0);
    });

    it("propagates NaN in DI inputs through the seed", () => {
        // length=2 -> seed window dx[2..3]. If any DI in the seed
        // window is NaN, the seed cannot form and the helper returns
        // all-NaN past warmup.
        const plusDi = new Float64Array([Number.NaN, Number.NaN, Number.NaN, 25]);
        const minusDi = new Float64Array([Number.NaN, Number.NaN, 10, 10]);
        const out = adxFromDi(plusDi, minusDi, 2);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("propagates NaN after the seed halts forward emission", () => {
        // length=2, n=6. seed indexes 2..3.
        const plusDi = new Float64Array([Number.NaN, Number.NaN, 30, 25, Number.NaN, 20]);
        const minusDi = new Float64Array([Number.NaN, Number.NaN, 10, 15, 20, 25]);
        const out = adxFromDi(plusDi, minusDi, 2);
        // seed at idx 3 valid; idx 4 sees NaN+ -> returns
        expect(Number.isFinite(out[3])).toBe(true);
        expect(Number.isNaN(out[4])).toBe(true);
        expect(Number.isNaN(out[5])).toBe(true);
    });

    it("matches a hand-computed reference, length=2", () => {
        // dx[2] = 100 * |30 - 10| / 40 = 50
        // dx[3] = 100 * |25 - 15| / 40 = 25
        // dx[4] = 100 * |20 - 20| / 40 = 0
        // dx[5] = 100 * |10 - 30| / 40 = 50
        // seed = (50 + 25) / 2 = 37.5 -> out[3] = 37.5
        // out[4] = (37.5 * 1 + 0) / 2 = 18.75
        // out[5] = (18.75 * 1 + 50) / 2 = 34.375
        const plusDi = new Float64Array([Number.NaN, Number.NaN, 30, 25, 20, 10]);
        const minusDi = new Float64Array([Number.NaN, Number.NaN, 10, 15, 20, 30]);
        const out = adxFromDi(plusDi, minusDi, 2);
        expect(Number.isNaN(out[0])).toBe(true);
        expect(Number.isNaN(out[1])).toBe(true);
        expect(Number.isNaN(out[2])).toBe(true);
        expect(out[3]).toBeCloseTo(37.5, 10);
        expect(out[4]).toBeCloseTo(18.75, 10);
        expect(out[5]).toBeCloseTo(34.375, 10);
    });
});
