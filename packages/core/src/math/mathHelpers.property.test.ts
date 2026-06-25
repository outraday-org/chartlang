// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { avg, clamp, roundTo } from "./mathHelpers.js";

const finite = fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e9, max: 1e9 });
const positiveStep = fc.double({ noNaN: true, noDefaultInfinity: true, min: 1e-6, max: 1e6 });

describe("math helper property invariants", () => {
    it("roundTo lands within step/2 of the input and on an integer multiple of step", () => {
        fc.assert(
            fc.property(finite, positiveStep, (value, step) => {
                const rounded = roundTo(value, step);
                expect(Math.abs(rounded - value)).toBeLessThanOrEqual(step / 2 + 1e-9);
                const multiple = rounded / step;
                expect(Math.abs(multiple - Math.round(multiple))).toBeLessThanOrEqual(1e-9);
            }),
            { numRuns: 100, seed: 13 },
        );
    });

    it("clamp always returns a value inside [lo, hi]", () => {
        fc.assert(
            fc.property(finite, finite, finite, (value, a, b) => {
                const lo = Math.min(a, b);
                const hi = Math.max(a, b);
                const out = clamp(value, lo, hi);
                expect(out).toBeGreaterThanOrEqual(lo);
                expect(out).toBeLessThanOrEqual(hi);
            }),
            { numRuns: 100, seed: 13 },
        );
    });

    it("avg of finite values stays within [min, max] of those values", () => {
        fc.assert(
            fc.property(fc.array(finite, { minLength: 1, maxLength: 16 }), (values) => {
                const mean = avg(...values);
                expect(mean).toBeGreaterThanOrEqual(Math.min(...values) - 1e-9);
                expect(mean).toBeLessThanOrEqual(Math.max(...values) + 1e-9);
            }),
            { numRuns: 100, seed: 13 },
        );
    });
});
