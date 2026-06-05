// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers";
import { harness } from "./__fixtures__/runPrimitive";
import { donchian } from "./donchian";

describe("ta.donchian — property invariants", () => {
    it("upper >= middle >= lower where defined", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 50 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => {
                    const d = donchian("slot", 5);
                    return { u: d.upper.current, m: d.middle.current, l: d.lower.current };
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

    it("returns the same DonchianResult identity across all bars", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 30 }), (bars) => {
                const refs: unknown[] = [];
                harness(bars, bars.length + 1, () => {
                    refs.push(donchian("slot", 4));
                    return null;
                });
                for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
            }),
            { numRuns: 15 },
        );
    });

    it("middle equals (upper + lower) / 2 where defined", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 40 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => {
                    const d = donchian("slot", 5);
                    return { u: d.upper.current, m: d.middle.current, l: d.lower.current };
                });
                for (const { u, m, l } of out) {
                    if (Number.isFinite(u) && Number.isFinite(l)) {
                        expect(m).toBeCloseTo((u + l) / 2, 12);
                    }
                }
            }),
            { numRuns: 15 },
        );
    });
});
