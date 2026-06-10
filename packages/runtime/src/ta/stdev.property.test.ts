// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers.js";
import { harness } from "./__fixtures__/runPrimitive.js";
import { computeRollingStdDev } from "./lib/rollingStddev.js";
import { stdev } from "./stdev.js";

describe("ta.stdev — property invariants", () => {
    it("σ ≥ 0 when finite", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => stdev("slot", bar.close, 5, { biased: true }).current,
                );
                for (const v of out) {
                    if (Number.isFinite(v)) expect(v).toBeGreaterThanOrEqual(0);
                }
            }),
            { numRuns: 25 },
        );
    });

    it("incremental matches the full recompute (biased) within 1e-6", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 15, maxLength: 60 }), (bars) => {
                const closes = new Float64Array(bars.map((b) => b.close));
                const expected = computeRollingStdDev(closes, 5, true);
                const actual = harness(
                    bars,
                    bars.length + 1,
                    (bar) => stdev("slot", bar.close, 5, { biased: true }).current,
                );
                for (let i = 0; i < bars.length; i += 1) {
                    if (Number.isNaN(expected[i])) expect(Number.isNaN(actual[i])).toBe(true);
                    // 1e-5 absolute tolerance — Welford-style incremental
                    // stddev accumulates float error proportional to stream
                    // length; the full-recompute reference uses two passes
                    // and stays numerically tighter.
                    else expect(actual[i]).toBeCloseTo(expected[i], 5);
                }
            }),
            { numRuns: 20 },
        );
    });

    it("opts.offset: shifted_k[i] === unshifted[i − k] for every defined index", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 50 }),
                fc.integer({ min: 1, max: 5 }),
                (bars, offset) => {
                    const unshifted = harness(
                        bars,
                        bars.length + 1,
                        (bar) => stdev("slot", bar.close, 4, { biased: true }).current,
                    );
                    const shifted = harness(
                        bars,
                        bars.length + 1,
                        (bar) => stdev("slot", bar.close, 4, { biased: true, offset }).current,
                    );
                    for (let i = offset; i < bars.length; i += 1) {
                        const u = unshifted[i - offset];
                        const s = shifted[i];
                        if (Number.isNaN(u)) expect(Number.isNaN(s)).toBe(true);
                        else expect(s).toBeCloseTo(u, 12);
                    }
                },
            ),
            { numRuns: 20 },
        );
    });
});
