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
});
