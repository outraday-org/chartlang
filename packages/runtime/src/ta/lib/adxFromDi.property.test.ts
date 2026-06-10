// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { adxFromDi } from "./adxFromDi.js";

const arbDiPair = fc.integer({ min: 10, max: 50 }).chain((n) =>
    fc.tuple(
        fc.constant(n),
        fc.array(fc.double({ min: 0, max: 100, noNaN: true }), {
            minLength: n,
            maxLength: n,
        }),
        fc.array(fc.double({ min: 0, max: 100, noNaN: true }), {
            minLength: n,
            maxLength: n,
        }),
    ),
);

describe("adxFromDi — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(arbDiPair, ([n, p, m]) => {
                const out = adxFromDi(new Float64Array(p), new Float64Array(m), 3);
                expect(out.length).toBe(n);
            }),
        );
    });

    it("warmup [0, 2*length-2] is NaN", () => {
        fc.assert(
            fc.property(arbDiPair, fc.integer({ min: 2, max: 5 }), ([n, p, m], length) => {
                const out = adxFromDi(new Float64Array(p), new Float64Array(m), length);
                const warmupEnd = Math.min(2 * length - 1, n);
                for (let i = 0; i < warmupEnd; i += 1) {
                    expect(Number.isNaN(out[i])).toBe(true);
                }
            }),
        );
    });

    it("is deterministic", () => {
        fc.assert(
            fc.property(arbDiPair, ([_n, p, m]) => {
                const a = adxFromDi(new Float64Array(p), new Float64Array(m), 3);
                const b = adxFromDi(new Float64Array(p), new Float64Array(m), 3);
                expect(Array.from(a)).toEqual(Array.from(b));
            }),
        );
    });

    it("valid ADX slots are in [0, 100]", () => {
        fc.assert(
            fc.property(arbDiPair, ([n, p, m]) => {
                const length = 3;
                const out = adxFromDi(new Float64Array(p), new Float64Array(m), length);
                for (let i = 2 * length - 1; i < n; i += 1) {
                    if (!Number.isFinite(out[i])) continue;
                    expect(out[i]).toBeGreaterThanOrEqual(0);
                    expect(out[i]).toBeLessThanOrEqual(100);
                }
            }),
        );
    });
});
