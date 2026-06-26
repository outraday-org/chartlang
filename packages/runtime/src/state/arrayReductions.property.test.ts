// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { Float64RingBuffer } from "../ringBuffer.js";
import {
    reduceAvg,
    reduceMax,
    reduceMedian,
    reduceMin,
    reducePercentile,
    reduceStdev,
    reduceVariance,
} from "./arrayReductions.js";

/** A non-empty window of finite doubles in a sane price-like range. */
const finiteWindow = fc
    .array(fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }), {
        minLength: 1,
        maxLength: 64,
    })
    .map((values) => {
        const ring = new Float64RingBuffer(values.length);
        for (const v of values) ring.append(v);
        return ring;
    });

/** Relative closeness — absolute `toBeCloseTo` is too strict for large variances. */
function expectRelClose(actual: number, expected: number, rel = 1e-9): void {
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(expected)));
}

/** Naive two-pass population/sample variance — the reference Welford must match. */
function naiveVariance(values: ReadonlyArray<number>, biased: boolean): number {
    const n = values.length;
    const denom = biased ? n : n - 1;
    if (denom <= 0) return Number.NaN;
    let mean = 0;
    for (const v of values) mean += v;
    mean /= n;
    let sumSq = 0;
    for (const v of values) sumSq += (v - mean) * (v - mean);
    return sumSq / denom;
}

describe("array reductions — properties", () => {
    it("min ≤ avg ≤ max for any finite window", () => {
        fc.assert(
            fc.property(finiteWindow, (ring) => {
                const min = reduceMin(ring);
                const avg = reduceAvg(ring);
                const max = reduceMax(ring);
                expect(min).toBeLessThanOrEqual(avg + 1e-9);
                expect(avg).toBeLessThanOrEqual(max + 1e-9);
            }),
        );
    });

    it("median ∈ [min, max]", () => {
        fc.assert(
            fc.property(finiteWindow, (ring) => {
                const med = reduceMedian(ring);
                expect(med).toBeGreaterThanOrEqual(reduceMin(ring) - 1e-9);
                expect(med).toBeLessThanOrEqual(reduceMax(ring) + 1e-9);
            }),
        );
    });

    it("stdev² ≈ variance (population and sample)", () => {
        fc.assert(
            fc.property(finiteWindow, fc.boolean(), (ring, biased) => {
                const variance = reduceVariance(ring, biased);
                const stdev = reduceStdev(ring, biased);
                if (Number.isNaN(variance)) {
                    expect(stdev).toBeNaN();
                    return;
                }
                expectRelClose(stdev * stdev, variance);
            }),
        );
    });

    it("percentile is monotonic non-decreasing in p", () => {
        fc.assert(
            fc.property(
                finiteWindow,
                fc.integer({ min: 0, max: 100 }),
                fc.integer({ min: 0, max: 100 }),
                (ring, a, b) => {
                    const lo = Math.min(a, b);
                    const hi = Math.max(a, b);
                    expect(reducePercentile(ring, lo)).toBeLessThanOrEqual(
                        reducePercentile(ring, hi) + 1e-6,
                    );
                },
            ),
        );
    });

    it("Welford variance matches the naive two-pass reference within 1e-9", () => {
        fc.assert(
            fc.property(
                fc.array(fc.double({ min: -1e3, max: 1e3, noNaN: true, noDefaultInfinity: true }), {
                    minLength: 1,
                    maxLength: 64,
                }),
                fc.boolean(),
                (values, biased) => {
                    const ring = new Float64RingBuffer(values.length);
                    for (const v of values) ring.append(v);
                    const welford = reduceVariance(ring, biased);
                    const naive = naiveVariance(values, biased);
                    if (Number.isNaN(naive)) {
                        expect(welford).toBeNaN();
                        return;
                    }
                    expectRelClose(welford, naive);
                },
            ),
        );
    });
});
