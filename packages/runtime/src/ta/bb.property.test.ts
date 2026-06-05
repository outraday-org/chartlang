// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers";
import { harness } from "./__fixtures__/runPrimitive";
import { bb } from "./bb";

describe("ta.bb — property invariants", () => {
    it("upper ≥ middle ≥ lower where defined", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 15, maxLength: 60 }), (bars) => {
                const out = harness(bars, bars.length + 1, (bar) => {
                    const r = bb("slot", bar.close, 5, { multiplier: 2 });
                    return { u: r.upper.current, m: r.middle.current, l: r.lower.current };
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

    it("returns the same record identity across all bars", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 30 }), (bars) => {
                const refs: unknown[] = [];
                harness(bars, bars.length + 1, (bar) => {
                    refs.push(bb("slot", bar.close, 4));
                    return null;
                });
                for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
            }),
            { numRuns: 15 },
        );
    });

    it("opts.offset: every band shifts by k slots in lockstep", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 50 }),
                fc.integer({ min: 1, max: 5 }),
                (bars, offset) => {
                    const unshifted = harness(bars, bars.length + 1, (bar) => {
                        const r = bb("slot", bar.close, 4);
                        return { u: r.upper.current, m: r.middle.current, l: r.lower.current };
                    });
                    const shifted = harness(bars, bars.length + 1, (bar) => {
                        const r = bb("slot", bar.close, 4, { offset });
                        return { u: r.upper.current, m: r.middle.current, l: r.lower.current };
                    });
                    for (let i = offset; i < bars.length; i += 1) {
                        const u = unshifted[i - offset];
                        const s = shifted[i];
                        for (const k of ["u", "m", "l"] as const) {
                            if (Number.isNaN(u[k])) expect(Number.isNaN(s[k])).toBe(true);
                            else expect(s[k]).toBeCloseTo(u[k], 12);
                        }
                    }
                },
            ),
            { numRuns: 20 },
        );
    });
});
