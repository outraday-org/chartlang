// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { dmi } from "./dmi.js";
import { wilderDirectional } from "./lib/wilderDirectional.js";
import { arbBar } from "./__fixtures__/propertyHelpers.js";
import { harness } from "./__fixtures__/runPrimitive.js";

describe("ta.dmi — property invariants", () => {
    it("plusDi ∈ [0, 100] and minusDi ∈ [0, 100] where defined", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 20, maxLength: 80 }),
                fc.integer({ min: 1, max: 10 }),
                (bars, length) => {
                    const out = harness(bars, bars.length + 1, () => {
                        const r = dmi("slot", length);
                        return { plusDi: r.plusDi.current, minusDi: r.minusDi.current };
                    });
                    for (const { plusDi, minusDi } of out) {
                        if (Number.isFinite(plusDi)) {
                            expect(plusDi).toBeGreaterThanOrEqual(0);
                            expect(plusDi).toBeLessThanOrEqual(100);
                        }
                        if (Number.isFinite(minusDi)) {
                            expect(minusDi).toBeGreaterThanOrEqual(0);
                            expect(minusDi).toBeLessThanOrEqual(100);
                        }
                    }
                },
            ),
            { numRuns: 25 },
        );
    });

    it("warmup: first `length` outputs are NaN with finite inputs", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 20, maxLength: 60 }),
                fc.integer({ min: 1, max: 8 }),
                (bars, length) => {
                    const out = harness(bars, bars.length + 1, () => {
                        const r = dmi("slot", length);
                        return r.plusDi.current;
                    });
                    for (let i = 0; i < length && i < out.length; i += 1) {
                        expect(Number.isNaN(out[i])).toBe(true);
                    }
                    if (out.length > length) {
                        expect(Number.isFinite(out[length])).toBe(true);
                    }
                },
            ),
            { numRuns: 25 },
        );
    });

    it("output length equals input length for both series", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 40 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => {
                    const r = dmi("slot", 5);
                    return { plusDi: r.plusDi.current, minusDi: r.minusDi.current };
                });
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 20 },
        );
    });

    it("incremental output equals the reference wilderDirectional within 1e-8", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 20, maxLength: 60 }), (bars) => {
                const highs = new Float64Array(bars.map((b) => b.high));
                const lows = new Float64Array(bars.map((b) => b.low));
                const closes = new Float64Array(bars.map((b) => b.close));
                const expected = wilderDirectional(highs, lows, closes, 5);
                const actual = harness(bars, bars.length + 1, () => {
                    const r = dmi("slot", 5);
                    return { plusDi: r.plusDi.current, minusDi: r.minusDi.current };
                });
                for (let i = 0; i < bars.length; i += 1) {
                    if (Number.isNaN(expected.plusDi[i])) {
                        expect(Number.isNaN(actual[i].plusDi)).toBe(true);
                    } else {
                        expect(actual[i].plusDi).toBeCloseTo(expected.plusDi[i], 8);
                        expect(actual[i].minusDi).toBeCloseTo(expected.minusDi[i], 8);
                    }
                }
            }),
            { numRuns: 20 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 15, maxLength: 50 }), (bars) => {
                const a = harness(bars, bars.length + 1, () => {
                    const r = dmi("slot", 5);
                    return { plusDi: r.plusDi.current, minusDi: r.minusDi.current };
                });
                const b = harness(bars, bars.length + 1, () => {
                    const r = dmi("slot", 5);
                    return { plusDi: r.plusDi.current, minusDi: r.minusDi.current };
                });
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i].plusDi)) expect(Number.isNaN(b[i].plusDi)).toBe(true);
                    else expect(b[i].plusDi).toBe(a[i].plusDi);
                    if (Number.isNaN(a[i].minusDi)) expect(Number.isNaN(b[i].minusDi)).toBe(true);
                    else expect(b[i].minusDi).toBe(a[i].minusDi);
                }
            }),
            { numRuns: 15 },
        );
    });

    it("returns the same DmiResult identity across all bars", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 30 }), (bars) => {
                const refs: unknown[] = [];
                harness(bars, bars.length + 1, () => {
                    refs.push(dmi("slot", 5));
                    return null;
                });
                for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
            }),
            { numRuns: 15 },
        );
    });
});
