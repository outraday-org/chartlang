// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers";
import { harness } from "./__fixtures__/runPrimitive";
import { rsi } from "./rsi";

describe("ta.rsi — property invariants", () => {
    it("output ∈ [0, 100] where defined", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 20, maxLength: 80 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => rsi("slot", bar.close, 14).current,
                );
                for (const v of out) {
                    if (Number.isFinite(v)) {
                        expect(v).toBeGreaterThanOrEqual(0);
                        expect(v).toBeLessThanOrEqual(100);
                    }
                }
            }),
            { numRuns: 25 },
        );
    });

    it("warmup is `length + 1` NaN slots (need initial close + length diffs)", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 20, maxLength: 60 }),
                fc.integer({ min: 2, max: 10 }),
                (bars, length) => {
                    const out = harness(
                        bars,
                        bars.length + 1,
                        (bar) => rsi("slot", bar.close, length).current,
                    );
                    // First `length` slots NaN; first defined value at index `length`.
                    for (let i = 0; i < length && i < out.length; i += 1) {
                        expect(Number.isNaN(out[i])).toBe(true);
                    }
                },
            ),
            { numRuns: 20 },
        );
    });
});
