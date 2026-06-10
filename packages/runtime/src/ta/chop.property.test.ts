// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers.js";
import { harness } from "./__fixtures__/runPrimitive.js";
import { chop } from "./chop.js";

describe("ta.chop — property invariants", () => {
    it("output ∈ [0, 100] on every defined slot", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 20, maxLength: 80 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => chop("slot", 5).current);
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

    it("emits finite or NaN only — never Infinity", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 40 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => chop("slot", 5).current);
                for (const v of out) {
                    expect(Number.isFinite(v) || Number.isNaN(v)).toBe(true);
                }
            }),
            { numRuns: 15 },
        );
    });

    it("warmup slots (first length-1) are always NaN", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 40 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => chop("slot", 7).current);
                for (let i = 0; i < Math.min(6, out.length); i += 1) {
                    expect(Number.isNaN(out[i])).toBe(true);
                }
            }),
            { numRuns: 15 },
        );
    });

    it("returns the same Series identity across all bars", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 30 }), (bars) => {
                const refs: unknown[] = [];
                harness(bars, bars.length + 1, () => {
                    refs.push(chop("slot", 5));
                    return null;
                });
                for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
            }),
            { numRuns: 15 },
        );
    });
});
