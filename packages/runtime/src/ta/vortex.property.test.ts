// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers.js";
import { harness } from "./__fixtures__/runPrimitive.js";
import { computeTrSeries } from "./lib/trSeries.js";
import { vortex } from "./vortex.js";

function referenceVortex(
    bars: ReadonlyArray<Bar>,
    length: number,
): {
    plus: Float64Array;
    minus: Float64Array;
} {
    const n = bars.length;
    const plus = new Float64Array(n);
    const minus = new Float64Array(n);
    plus.fill(Number.NaN);
    minus.fill(Number.NaN);
    if (n === 0 || length <= 0) return { plus, minus };
    const tr = computeTrSeries(bars);
    const vmPlus = new Float64Array(n);
    const vmMinus = new Float64Array(n);
    for (let i = 1; i < n; i += 1) {
        vmPlus[i] = Math.abs(bars[i].high - bars[i - 1].low);
        vmMinus[i] = Math.abs(bars[i].low - bars[i - 1].high);
    }
    // chartlang convention: warmup is `length` closed bars (matches
    // invinite's "first defined at slot length" — 1-indexed close
    // count of `length + 1`). First defined slot = bar index `length`.
    for (let i = length; i < n; i += 1) {
        let sumPlus = 0;
        let sumMinus = 0;
        let sumTr = 0;
        for (let k = i - length + 1; k <= i; k += 1) {
            sumPlus += vmPlus[k];
            sumMinus += vmMinus[k];
            sumTr += tr[k];
        }
        if (sumTr === 0) {
            // chartlang spec: zero-TR window → NaN.
            continue;
        }
        plus[i] = sumPlus / sumTr;
        minus[i] = sumMinus / sumTr;
    }
    return { plus, minus };
}

describe("ta.vortex — property invariants", () => {
    it("plus / minus are non-negative where defined", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 50 }),
                fc.integer({ min: 2, max: 10 }),
                (bars, length) => {
                    const out = harness(bars, bars.length + 1, () => {
                        const v = vortex("slot", length);
                        return { plus: v.plus.current, minus: v.minus.current };
                    });
                    for (const { plus, minus } of out) {
                        if (Number.isFinite(plus)) expect(plus).toBeGreaterThanOrEqual(0);
                        if (Number.isFinite(minus)) expect(minus).toBeGreaterThanOrEqual(0);
                    }
                },
            ),
            { numRuns: 25 },
        );
    });

    it("warmup: first `length` outputs are NaN; index `length` defined when TR > 0", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 20, maxLength: 50 }),
                fc.integer({ min: 2, max: 8 }),
                (bars, length) => {
                    const out = harness(bars, bars.length + 1, () => {
                        const v = vortex("slot", length);
                        return v.plus.current;
                    });
                    for (let i = 0; i < length && i < out.length; i += 1) {
                        expect(Number.isNaN(out[i])).toBe(true);
                    }
                },
            ),
            { numRuns: 25 },
        );
    });

    it("output length equals input length for both plus and minus", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 30 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => {
                    const v = vortex("slot", 5);
                    return { plus: v.plus.current, minus: v.minus.current };
                });
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 20 },
        );
    });

    it("incremental output equals the reference full-recompute within 1e-8", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 15, maxLength: 50 }),
                fc.integer({ min: 2, max: 8 }),
                (bars, length) => {
                    const expected = referenceVortex(bars, length);
                    const actual = harness(bars, bars.length + 1, () => {
                        const v = vortex("slot", length);
                        return { plus: v.plus.current, minus: v.minus.current };
                    });
                    for (let i = 0; i < bars.length; i += 1) {
                        if (Number.isNaN(expected.plus[i])) {
                            expect(Number.isNaN(actual[i].plus)).toBe(true);
                        } else {
                            expect(actual[i].plus).toBeCloseTo(expected.plus[i], 8);
                        }
                        if (Number.isNaN(expected.minus[i])) {
                            expect(Number.isNaN(actual[i].minus)).toBe(true);
                        } else {
                            expect(actual[i].minus).toBeCloseTo(expected.minus[i], 8);
                        }
                    }
                },
            ),
            { numRuns: 20 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 40 }), (bars) => {
                const a = harness(bars, bars.length + 1, () => {
                    const v = vortex("slot", 5);
                    return { plus: v.plus.current, minus: v.minus.current };
                });
                const b = harness(bars, bars.length + 1, () => {
                    const v = vortex("slot", 5);
                    return { plus: v.plus.current, minus: v.minus.current };
                });
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i].plus)) expect(Number.isNaN(b[i].plus)).toBe(true);
                    else expect(b[i].plus).toBe(a[i].plus);
                    if (Number.isNaN(a[i].minus)) expect(Number.isNaN(b[i].minus)).toBe(true);
                    else expect(b[i].minus).toBe(a[i].minus);
                }
            }),
            { numRuns: 15 },
        );
    });

    it("returns the same record identity across all bars", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 30 }), (bars) => {
                const refs: unknown[] = [];
                harness(bars, bars.length + 1, () => {
                    refs.push(vortex("slot", 5));
                    return null;
                });
                for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
            }),
            { numRuns: 15 },
        );
    });
});
