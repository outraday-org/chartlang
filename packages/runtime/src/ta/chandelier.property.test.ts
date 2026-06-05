// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { chandelier } from "./chandelier";
import { arbBar } from "./__fixtures__/propertyHelpers";
import { harness } from "./__fixtures__/runPrimitive";

describe("ta.chandelier — property invariants", () => {
    it("long ≤ trailing highest(high) and short ≥ trailing lowest(low) where defined (multiplier ≥ 0)", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 60 }),
                fc.integer({ min: 2, max: 10 }),
                fc.double({ min: 0.5, max: 5, noNaN: true }),
                (bars, length, multiplier) => {
                    const out = harness(bars, bars.length + 1, () => {
                        const c = chandelier("slot", { length, multiplier });
                        return { long: c.long.current, short: c.short.current };
                    });
                    // long = highest(high, length) - multiplier*ATR, ATR ≥ 0
                    // → long ≤ trailing-max(high) over the window.
                    // Compute the trailing window-max for each bar.
                    for (let i = length - 1; i < bars.length; i += 1) {
                        if (!Number.isFinite(out[i].long)) continue;
                        let hi = Number.NEGATIVE_INFINITY;
                        let lo = Number.POSITIVE_INFINITY;
                        for (let j = i - length + 1; j <= i; j += 1) {
                            if (bars[j].high > hi) hi = bars[j].high;
                            if (bars[j].low < lo) lo = bars[j].low;
                        }
                        expect(out[i].long).toBeLessThanOrEqual(hi + 1e-9);
                        if (Number.isFinite(out[i].short)) {
                            expect(out[i].short).toBeGreaterThanOrEqual(lo - 1e-9);
                        }
                    }
                },
            ),
            { numRuns: 25 },
        );
    });

    it("warmup: first `length - 1` outputs are NaN with finite inputs", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 50 }),
                fc.integer({ min: 2, max: 8 }),
                (bars, length) => {
                    const out = harness(bars, bars.length + 1, () => {
                        const c = chandelier("slot", { length, multiplier: 2 });
                        return c.long.current;
                    });
                    for (let i = 0; i < length - 1 && i < out.length; i += 1) {
                        expect(Number.isNaN(out[i])).toBe(true);
                    }
                    if (out.length > length - 1) {
                        expect(Number.isFinite(out[length - 1])).toBe(true);
                    }
                },
            ),
            { numRuns: 20 },
        );
    });

    it("output length equals input length for both series", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 40 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => {
                    const c = chandelier("slot", { length: 5, multiplier: 2 });
                    return { long: c.long.current, short: c.short.current };
                });
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 20 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 40 }), (bars) => {
                const a = harness(bars, bars.length + 1, () => {
                    const c = chandelier("slot", { length: 5, multiplier: 2 });
                    return { long: c.long.current, short: c.short.current };
                });
                const b = harness(bars, bars.length + 1, () => {
                    const c = chandelier("slot", { length: 5, multiplier: 2 });
                    return { long: c.long.current, short: c.short.current };
                });
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i].long)) expect(Number.isNaN(b[i].long)).toBe(true);
                    else expect(b[i].long).toBe(a[i].long);
                    if (Number.isNaN(a[i].short)) expect(Number.isNaN(b[i].short)).toBe(true);
                    else expect(b[i].short).toBe(a[i].short);
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
                    refs.push(chandelier("slot"));
                    return null;
                });
                for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
            }),
            { numRuns: 15 },
        );
    });
});
