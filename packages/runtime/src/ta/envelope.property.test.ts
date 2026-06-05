// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers";
import { harness } from "./__fixtures__/runPrimitive";
import { envelope } from "./envelope";

describe("ta.envelope — property invariants", () => {
    it("upper >= middle >= lower (when middle >= 0); upper <= middle <= lower (when middle < 0)", () => {
        // Pure multiplicative offset; ordering is sign-dependent.
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 50 }), (bars) => {
                const out = harness(bars, bars.length + 1, (b) => {
                    const e = envelope("slot", b.close, { length: 5, percent: 10 });
                    return { u: e.upper.current, m: e.middle.current, l: e.lower.current };
                });
                for (const { u, m, l } of out) {
                    if (Number.isFinite(u) && Number.isFinite(m) && Number.isFinite(l)) {
                        if (m >= 0) {
                            expect(u).toBeGreaterThanOrEqual(m);
                            expect(m).toBeGreaterThanOrEqual(l);
                        } else {
                            expect(u).toBeLessThanOrEqual(m);
                            expect(m).toBeLessThanOrEqual(l);
                        }
                    }
                }
            }),
            { numRuns: 25 },
        );
    });

    it("returns the same EnvelopeResult identity across all bars", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 30 }), (bars) => {
                const refs: unknown[] = [];
                harness(bars, bars.length + 1, (b) => {
                    refs.push(envelope("slot", b.close, { length: 5 }));
                    return null;
                });
                for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
            }),
            { numRuns: 15 },
        );
    });

    it("(upper - middle) / middle === percent / 100 where middle ≠ 0", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 50 }), (bars) => {
                const out = harness(bars, bars.length + 1, (b) => {
                    const e = envelope("slot", b.close, { length: 5, percent: 10 });
                    return { u: e.upper.current, m: e.middle.current };
                });
                for (const { u, m } of out) {
                    if (Number.isFinite(u) && Number.isFinite(m) && m !== 0) {
                        expect((u - m) / m).toBeCloseTo(0.1, 8);
                    }
                }
            }),
            { numRuns: 15 },
        );
    });

    it("emits finite or NaN only — never Infinity", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 8, maxLength: 30 }), (bars) => {
                const out = harness(bars, bars.length + 1, (b) => {
                    const e = envelope("slot", b.close, { length: 4, percent: 5 });
                    return { u: e.upper.current, m: e.middle.current, l: e.lower.current };
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
