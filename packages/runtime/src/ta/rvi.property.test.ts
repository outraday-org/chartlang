// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers.js";
import { harness } from "./__fixtures__/runPrimitive.js";
import { rvi } from "./rvi.js";

describe("ta.rvi — property invariants", () => {
    it("output is in [0, 100] when defined", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 15, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => rvi("slot", bar.close, 5).current,
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

    it("output is finite or NaN (no Infinity)", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 15, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => rvi("slot", bar.close, 5).current,
                );
                for (const v of out) {
                    expect(Number.isNaN(v) || Number.isFinite(v)).toBe(true);
                }
            }),
            { numRuns: 25 },
        );
    });

    it("returns the same Series identity across all bars", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 30 }), (bars) => {
                const refs: unknown[] = [];
                harness(bars, bars.length + 1, (bar) => {
                    refs.push(rvi("slot", bar.close, 5));
                    return null;
                });
                for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
            }),
            { numRuns: 15 },
        );
    });
});
