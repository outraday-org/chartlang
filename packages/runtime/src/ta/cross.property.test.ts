// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers.js";
import { harness } from "./__fixtures__/runPrimitive.js";
import { cross } from "./cross.js";
import { crossover } from "./crossover.js";
import { crossunder } from "./crossunder.js";

describe("ta.cross — property invariants", () => {
    it("cross[t] === crossover[t] || crossunder[t] for random arrays", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(bars, bars.length + 1, (bar) => {
                    const c = cross("x", bar.close, 500).current;
                    // Advance BOTH sub-primitives every bar (a `||` on the
                    // `.current` reads would short-circuit the crossunder call
                    // and desync it).
                    const o = crossover("o", bar.close, 500).current;
                    const u = crossunder("u", bar.close, 500).current;
                    return { c, ref: o || u };
                });
                for (const { c, ref } of out) expect(c).toBe(ref);
            }),
            { numRuns: 25 },
        );
    });

    it("output is always boolean — cross / no-cross are exhaustive (never NaN)", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => cross("slot", bar.close, 500).current,
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
                    (bar) => cross("slot", bar.close, 500).current,
                );
                expect(out[0]).toBe(false);
            }),
            { numRuns: 15 },
        );
    });
});
