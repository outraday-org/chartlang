// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { linearRegression } from "./linearRegression";

const arbSeries = fc.integer({ min: 10, max: 60 }).chain((n) =>
    fc.tuple(
        fc.constant(n),
        fc.array(fc.double({ min: -1000, max: 1000, noNaN: true }), {
            minLength: n,
            maxLength: n,
        }),
    ),
);

// Independent O(N²) reference: re-derive slope/intercept from raw
// Σx, Σy, Σxy, Σx² over the same window. Pure naive form, used to
// catch any drift in the precomputed-xDev closed-form path.
function referenceFit(
    values: Float64Array,
    startIdx: number,
    length: number,
): { slope: number; intercept: number } {
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    for (let j = 0; j < length; j += 1) {
        const x = j;
        const y = values[startIdx + j];
        if (!Number.isFinite(y)) return { intercept: Number.NaN, slope: Number.NaN };
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
    }
    const denom = length * sumXX - sumX * sumX;
    const slope = (length * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / length;
    return { intercept, slope };
}

describe("linearRegression — property invariants", () => {
    it("output lengths equal input length", () => {
        fc.assert(
            fc.property(arbSeries, ([n, ys]) => {
                const out = linearRegression(new Float64Array(ys), 5);
                expect(out.slope.length).toBe(n);
                expect(out.intercept.length).toBe(n);
                expect(out.value.length).toBe(n);
            }),
        );
    });

    it("warmup [0, length-2] is NaN on all three outputs", () => {
        fc.assert(
            fc.property(arbSeries, fc.integer({ min: 2, max: 8 }), ([n, ys], length) => {
                const out = linearRegression(new Float64Array(ys), length);
                for (let i = 0; i < Math.min(length - 1, n); i += 1) {
                    expect(Number.isNaN(out.slope[i])).toBe(true);
                    expect(Number.isNaN(out.intercept[i])).toBe(true);
                    expect(Number.isNaN(out.value[i])).toBe(true);
                }
            }),
        );
    });

    it("is deterministic", () => {
        fc.assert(
            fc.property(arbSeries, ([_n, ys]) => {
                const src = new Float64Array(ys);
                const a = linearRegression(src, 5);
                const b = linearRegression(src, 5);
                expect(Array.from(a.slope)).toEqual(Array.from(b.slope));
                expect(Array.from(a.intercept)).toEqual(Array.from(b.intercept));
                expect(Array.from(a.value)).toEqual(Array.from(b.value));
            }),
        );
    });

    it("matches an independent Σ-sum reference within 1e-6", () => {
        fc.assert(
            fc.property(arbSeries, ([n, ys]) => {
                const src = new Float64Array(ys);
                const length = 5;
                const out = linearRegression(src, length);
                for (let i = length - 1; i < n; i += 1) {
                    const ref = referenceFit(src, i - length + 1, length);
                    if (!Number.isFinite(out.slope[i])) {
                        expect(Number.isNaN(ref.slope)).toBe(true);
                        continue;
                    }
                    expect(out.slope[i]).toBeCloseTo(ref.slope, 6);
                    expect(out.intercept[i]).toBeCloseTo(ref.intercept, 6);
                    expect(out.value[i]).toBeCloseTo(ref.intercept + ref.slope * (length - 1), 6);
                }
            }),
            { numRuns: 20 },
        );
    });
});
