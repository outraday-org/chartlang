// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { wmaFloat64 } from "./wmaFloat64.js";

const arbFinite = fc.double({ min: 1, max: 1000, noNaN: true });
const arbLength = fc.integer({ min: 2, max: 12 });

describe("wmaFloat64 — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(
                fc.array(arbFinite, { minLength: 5, maxLength: 80 }),
                arbLength,
                (values, length) => {
                    const out = wmaFloat64(new Float64Array(values), length);
                    expect(out.length).toBe(values.length);
                },
            ),
        );
    });

    it("warmup is exactly length - 1 NaN slots for all-finite input", () => {
        fc.assert(
            fc.property(
                fc.array(arbFinite, { minLength: 15, maxLength: 50 }),
                arbLength,
                (values, length) => {
                    const out = wmaFloat64(new Float64Array(values), length);
                    for (let i = 0; i < length - 1 && i < out.length; i += 1) {
                        expect(Number.isNaN(out[i])).toBe(true);
                    }
                    if (out.length >= length) {
                        expect(Number.isFinite(out[length - 1])).toBe(true);
                    }
                },
            ),
        );
    });

    it("constant input yields constant output post-warmup", () => {
        fc.assert(
            fc.property(
                fc.double({ min: 1, max: 1000, noNaN: true }),
                arbLength,
                fc.integer({ min: 20, max: 60 }),
                (constant, length, n) => {
                    const values = new Float64Array(n);
                    values.fill(constant);
                    const out = wmaFloat64(values, length);
                    for (let i = length - 1; i < n; i += 1) {
                        expect(out[i]).toBeCloseTo(constant, 10);
                    }
                },
            ),
        );
    });

    it("determinism: same input → bitwise-identical output", () => {
        fc.assert(
            fc.property(
                fc.array(arbFinite, { minLength: 10, maxLength: 60 }),
                arbLength,
                (values, length) => {
                    const a = wmaFloat64(new Float64Array(values), length);
                    const b = wmaFloat64(new Float64Array(values), length);
                    expect(a.length).toBe(b.length);
                    for (let i = 0; i < a.length; i += 1) {
                        if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                        else expect(b[i]).toBe(a[i]);
                    }
                },
            ),
        );
    });

    it("NaN at index i ⇒ out[i] is NaN (window short-circuit)", () => {
        fc.assert(
            fc.property(
                fc.array(arbFinite, { minLength: 20, maxLength: 40 }),
                fc.integer({ min: 5, max: 15 }),
                arbLength,
                (values, nanIdx, length) => {
                    const clamped = Math.min(nanIdx, values.length - 1);
                    const arr = new Float64Array(values);
                    arr[clamped] = Number.NaN;
                    const out = wmaFloat64(arr, length);
                    expect(Number.isNaN(out[clamped])).toBe(true);
                },
            ),
        );
    });
});
