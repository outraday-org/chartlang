// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers.js";
import { harness } from "./__fixtures__/runPrimitive.js";
import { keltner } from "./keltner.js";

describe("ta.keltner — property invariants", () => {
    it("upper >= middle >= lower where defined", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 12, maxLength: 50 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => {
                    const k = keltner("slot", { length: 5, multiplier: 2, maType: "sma" });
                    return { u: k.upper.current, m: k.middle.current, l: k.lower.current };
                });
                for (const { u, m, l } of out) {
                    if (Number.isFinite(u) && Number.isFinite(m))
                        expect(u).toBeGreaterThanOrEqual(m);
                    if (Number.isFinite(m) && Number.isFinite(l))
                        expect(m).toBeGreaterThanOrEqual(l);
                }
            }),
            { numRuns: 25 },
        );
    });

    it("returns the same KeltnerResult identity across all bars", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 30 }), (bars) => {
                const refs: unknown[] = [];
                harness(bars, bars.length + 1, () => {
                    refs.push(keltner("slot", { length: 5 }));
                    return null;
                });
                for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
            }),
            { numRuns: 15 },
        );
    });

    it("(upper - middle) === (middle - lower) where defined", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 12, maxLength: 50 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => {
                    const k = keltner("slot", { length: 5, multiplier: 2 });
                    return { u: k.upper.current, m: k.middle.current, l: k.lower.current };
                });
                for (const { u, m, l } of out) {
                    if (Number.isFinite(u) && Number.isFinite(m) && Number.isFinite(l)) {
                        expect(u - m).toBeCloseTo(m - l, 10);
                    }
                }
            }),
            { numRuns: 15 },
        );
    });

    it("emits finite or NaN only — never Infinity", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 8, maxLength: 30 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => {
                    const k = keltner("slot", { length: 4 });
                    return { u: k.upper.current, m: k.middle.current, l: k.lower.current };
                });
                for (const { u, m, l } of out) {
                    expect(Number.isFinite(u) || Number.isNaN(u)).toBe(true);
                    expect(Number.isFinite(m) || Number.isNaN(m)).toBe(true);
                    expect(Number.isFinite(l) || Number.isNaN(l)).toBe(true);
                }
            }),
            { numRuns: 15 },
        );
    });
});
