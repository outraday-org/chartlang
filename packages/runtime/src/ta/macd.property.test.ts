// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers.js";
import { harness } from "./__fixtures__/runPrimitive.js";
import { macd } from "./macd.js";

describe("ta.macd — property invariants", () => {
    it("hist = macd − signal where both are finite", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 60, maxLength: 120 }), (bars) => {
                const out = harness(bars, bars.length + 1, (bar) => {
                    const r = macd("slot", bar.close, {
                        fastLength: 5,
                        slowLength: 13,
                        signalLength: 3,
                    });
                    return { m: r.macd.current, s: r.signal.current, h: r.hist.current };
                });
                for (const { m, s, h } of out) {
                    if (Number.isFinite(m) && Number.isFinite(s)) {
                        expect(h).toBeCloseTo(m - s, 8);
                    }
                }
            }),
            { numRuns: 15 },
        );
    });

    it("returns the same record identity across bars", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 40 }), (bars) => {
                const refs: unknown[] = [];
                harness(bars, bars.length + 1, (bar) => {
                    refs.push(macd("slot", bar.close));
                    return null;
                });
                for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
            }),
            { numRuns: 10 },
        );
    });

    it("opts.offset: leaves every output unshifted (presentation-only)", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 40, maxLength: 100 }),
                fc.integer({ min: -5, max: 5 }).filter((o) => o !== 0),
                (bars, offset) => {
                    const unshifted = harness(bars, bars.length + 1, (bar) => {
                        const r = macd("slot", bar.close, {
                            fastLength: 5,
                            slowLength: 13,
                            signalLength: 3,
                        });
                        return { m: r.macd.current, s: r.signal.current, h: r.hist.current };
                    });
                    const shifted = harness(bars, bars.length + 1, (bar) => {
                        const r = macd("slot", bar.close, {
                            fastLength: 5,
                            slowLength: 13,
                            signalLength: 3,
                            offset,
                        });
                        return { m: r.macd.current, s: r.signal.current, h: r.hist.current };
                    });
                    for (let i = 0; i < bars.length; i += 1) {
                        const u = unshifted[i];
                        const s = shifted[i];
                        for (const k of ["m", "s", "h"] as const) {
                            if (Number.isNaN(u[k])) expect(Number.isNaN(s[k])).toBe(true);
                            else expect(s[k]).toBeCloseTo(u[k], 8);
                        }
                    }
                },
            ),
            { numRuns: 15 },
        );
    });
});
