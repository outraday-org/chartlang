// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers";
import { harness } from "./__fixtures__/runPrimitive";
import { bbPercentB } from "./bbPercentB";

describe("ta.bbPercentB — property invariants", () => {
    it("output is finite or NaN (no Infinity)", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 50 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => bbPercentB("slot", bar.close, 5).current,
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
                    refs.push(bbPercentB("slot", bar.close, 4));
                    return null;
                });
                for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
            }),
            { numRuns: 15 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 40 }), (bars) => {
                const a = harness(
                    bars,
                    bars.length + 1,
                    (bar) => bbPercentB("slot", bar.close, 5).current,
                );
                const b = harness(
                    bars,
                    bars.length + 1,
                    (bar) => bbPercentB("slot", bar.close, 5).current,
                );
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                    else expect(b[i]).toBe(a[i]);
                }
            }),
            { numRuns: 15 },
        );
    });
});
