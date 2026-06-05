// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers";
import { harness } from "./__fixtures__/runPrimitive";
import { massIndex } from "./massIndex";

describe("ta.massIndex — property invariants", () => {
    it("output is finite or NaN (no Infinity)", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 50, maxLength: 80 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    () => massIndex("slot", { emaLength: 5, sumLength: 10 }).current,
                );
                for (const v of out) {
                    expect(Number.isNaN(v) || Number.isFinite(v)).toBe(true);
                }
            }),
            { numRuns: 25 },
        );
    });

    it("output is non-negative when defined (range ≥ 0 → ratio ≥ 0 → sum ≥ 0)", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 50, maxLength: 80 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    () => massIndex("slot", { emaLength: 5, sumLength: 10 }).current,
                );
                for (const v of out) {
                    if (Number.isFinite(v)) expect(v).toBeGreaterThanOrEqual(0);
                }
            }),
            { numRuns: 25 },
        );
    });

    it("returns the same Series identity across all bars", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 30 }), (bars) => {
                const refs: unknown[] = [];
                harness(bars, bars.length + 1, () => {
                    refs.push(massIndex("slot"));
                    return null;
                });
                for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
            }),
            { numRuns: 15 },
        );
    });
});
