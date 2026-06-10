// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { pearson } from "./pearson.js";

const arbPair = fc.integer({ min: 10, max: 50 }).chain((n) =>
    fc.tuple(
        fc.constant(n),
        fc.array(fc.double({ min: -100, max: 100, noNaN: true }), {
            minLength: n,
            maxLength: n,
        }),
        fc.array(fc.double({ min: -100, max: 100, noNaN: true }), {
            minLength: n,
            maxLength: n,
        }),
    ),
);

describe("pearson — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(arbPair, ([n, a, b]) => {
                const out = pearson(new Float64Array(a), new Float64Array(b), 5);
                expect(out.length).toBe(n);
            }),
        );
    });

    it("warmup [0, length-2] is NaN", () => {
        fc.assert(
            fc.property(arbPair, fc.integer({ min: 2, max: 8 }), ([n, a, b], length) => {
                const out = pearson(new Float64Array(a), new Float64Array(b), length);
                for (let i = 0; i < Math.min(length - 1, n); i += 1) {
                    expect(Number.isNaN(out[i])).toBe(true);
                }
            }),
        );
    });

    it("is deterministic", () => {
        fc.assert(
            fc.property(arbPair, ([_n, a, b]) => {
                const aF = new Float64Array(a);
                const bF = new Float64Array(b);
                const x = pearson(aF, bF, 5);
                const y = pearson(aF, bF, 5);
                expect(Array.from(x)).toEqual(Array.from(y));
            }),
        );
    });

    it("valid slots lie in [-1, +1]", () => {
        fc.assert(
            fc.property(arbPair, ([n, a, b]) => {
                const length = 5;
                const out = pearson(new Float64Array(a), new Float64Array(b), length);
                for (let i = length - 1; i < n; i += 1) {
                    if (!Number.isFinite(out[i])) continue;
                    expect(out[i]).toBeGreaterThanOrEqual(-1);
                    expect(out[i]).toBeLessThanOrEqual(1);
                }
            }),
        );
    });

    it("is symmetric: pearson(a, b, L) === pearson(b, a, L)", () => {
        fc.assert(
            fc.property(arbPair, ([n, a, b]) => {
                const length = 5;
                const aF = new Float64Array(a);
                const bF = new Float64Array(b);
                const ab = pearson(aF, bF, length);
                const ba = pearson(bF, aF, length);
                for (let i = length - 1; i < n; i += 1) {
                    if (Number.isNaN(ab[i])) {
                        expect(Number.isNaN(ba[i])).toBe(true);
                        continue;
                    }
                    expect(ab[i]).toBeCloseTo(ba[i], 12);
                }
            }),
        );
    });
});
