// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers";
import { harness } from "./__fixtures__/runPrimitive";
import { computeRollingStdDev } from "./lib/rollingStddev";
import { stdev } from "./stdev";

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
                    else expect(actual[i]).toBeCloseTo(expected[i], 6);
                }
            }),
            { numRuns: 20 },
        );
    });
});
