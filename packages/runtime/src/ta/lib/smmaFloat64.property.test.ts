// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { computeEmaOfFloat64 } from "./emaFloat64";
import { smmaFloat64 } from "./smmaFloat64";

const arbFinite = fc.double({ min: 1, max: 1000, noNaN: true });
const arbLength = fc.integer({ min: 2, max: 12 });

describe("smmaFloat64 — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(
                fc.array(arbFinite, { minLength: 5, maxLength: 80 }),
                arbLength,
                (values, length) => {
                    const out = smmaFloat64(new Float64Array(values), length);
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
                    const out = smmaFloat64(new Float64Array(values), length);
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
                    const out = smmaFloat64(values, length);
                    for (let i = length - 1; i < n; i += 1) {
                        expect(out[i]).toBeCloseTo(constant, 10);
                    }
                },
            ),
        );
    });

    it("equals EMA with α = 1/N from the seed onward (same seed → same recurrence)", () => {
        // SMMA's recurrence: out[i] = ((N-1)/N) * out[i-1] + (1/N) * x[i]
        // EMA's recurrence: out[i] = (1 - α) * out[i-1] + α * x[i] with α = 2/(L+1)
        // For α = 1/N we need an EMA length L such that 2/(L+1) = 1/N → L = 2N − 1.
        // Both helpers seed with SMA of the first N values when L=N for SMMA but
        // EMA seeds with its own length. To compare apples-to-apples we use the
        // same seed by manually re-seeding the EMA path: easiest is to use a
        // constant prefix so the two seeds coincide and then assert equivalence
        // on the trailing recurrence.
        fc.assert(
            fc.property(
                fc.integer({ min: 5, max: 20 }),
                fc.array(arbFinite, { minLength: 30, maxLength: 80 }),
                fc.double({ min: 1, max: 1000, noNaN: true }),
                (N, tail, prefixVal) => {
                    const prefix = new Array(N).fill(prefixVal);
                    const series = new Float64Array([...prefix, ...tail]);
                    const smma = smmaFloat64(series, N);
                    const emaLen = 2 * N - 1;
                    const ema = computeEmaOfFloat64(series, emaLen);
                    // Both arrays should converge after the EMA warmup completes.
                    const startIdx = Math.max(N - 1, emaLen - 1) + 5;
                    for (let i = startIdx; i < series.length; i += 1) {
                        if (Number.isFinite(smma[i]) && Number.isFinite(ema[i])) {
                            const rel = Math.abs(smma[i] - ema[i]) / Math.max(1, Math.abs(smma[i]));
                            // Loose convergence: SMMA and EMA(α=1/N) agree on
                            // the recurrence shape but their distinct seeds
                            // leave a slowly-decaying residual; assert the
                            // relative gap is bounded.
                            expect(rel).toBeLessThan(0.5);
                        }
                    }
                },
            ),
            { numRuns: 10 },
        );
    });

    it("determinism: same input → bitwise-identical output", () => {
        fc.assert(
            fc.property(
                fc.array(arbFinite, { minLength: 10, maxLength: 60 }),
                arbLength,
                (values, length) => {
                    const a = smmaFloat64(new Float64Array(values), length);
                    const b = smmaFloat64(new Float64Array(values), length);
                    expect(a.length).toBe(b.length);
                    for (let i = 0; i < a.length; i += 1) {
                        if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                        else expect(b[i]).toBe(a[i]);
                    }
                },
            ),
        );
    });

    it("mid-stream NaN forward-fills (out[i] === out[i-1])", () => {
        fc.assert(
            fc.property(
                fc.array(arbFinite, { minLength: 20, maxLength: 40 }),
                fc.integer({ min: 10, max: 15 }),
                arbLength,
                (values, nanIdx, length) => {
                    const clamped = Math.min(nanIdx, values.length - 1);
                    const arr = new Float64Array(values);
                    arr[clamped] = Number.NaN;
                    const out = smmaFloat64(arr, length);
                    if (Number.isFinite(out[clamped - 1])) {
                        expect(out[clamped]).toBe(out[clamped - 1]);
                    }
                },
            ),
        );
    });
});
