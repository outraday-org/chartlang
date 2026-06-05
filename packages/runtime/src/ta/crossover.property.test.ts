// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers";
import { harness } from "./__fixtures__/runPrimitive";
import { crossover } from "./crossover";

describe("ta.crossover — property invariants", () => {
    it("output is always boolean (never NaN)", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => crossover("slot", bar.close, 500).current,
                );
                for (const v of out) expect(typeof v).toBe("boolean");
            }),
            { numRuns: 25 },
        );
    });

    it("bar 0 is always false (no prior bar)", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 30 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => crossover("slot", bar.close, 500).current,
                );
                expect(out[0]).toBe(false);
            }),
            { numRuns: 15 },
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
                        (bar) => crossover("slot", bar.close, 500).current,
                    );
                    const shifted = harness(
                        bars,
                        bars.length + 1,
                        (bar) => crossover("slot", bar.close, 500, { offset }).current,
                    );
                    for (let i = offset; i < bars.length; i += 1) {
                        expect(shifted[i]).toBe(unshifted[i - offset]);
                    }
                },
            ),
            { numRuns: 20 },
        );
    });
});
