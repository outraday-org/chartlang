// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers.js";
import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { volatilityStop } from "./volatilityStop.js";

describe("ta.volatilityStop — property invariants", () => {
    it("direction ∈ {+1, -1, NaN} on every bar", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 60 }),
                fc.integer({ min: 2, max: 10 }),
                (bars, length) => {
                    const out = harness(bars, bars.length + 1, () => {
                        const v = volatilityStop("slot", { length, multiplier: 2 });
                        return v.direction.current;
                    });
                    for (const d of out) {
                        expect(d === 1 || d === -1 || Number.isNaN(d)).toBe(true);
                    }
                },
            ),
            { numRuns: 25 },
        );
    });

    it("value is finite whenever direction is finite", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 50 }),
                fc.integer({ min: 2, max: 8 }),
                (bars, length) => {
                    const out = harness(bars, bars.length + 1, () => {
                        const v = volatilityStop("slot", { length, multiplier: 2 });
                        return { value: v.value.current, direction: v.direction.current };
                    });
                    for (const { value, direction } of out) {
                        if (Number.isFinite(direction)) {
                            expect(Number.isFinite(value)).toBe(true);
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
                fc.array(arbBar, { minLength: 10, maxLength: 40 }),
                fc.integer({ min: 2, max: 6 }),
                (bars, length) => {
                    const out = harness(bars, bars.length + 1, () => {
                        const v = volatilityStop("slot", { length, multiplier: 2 });
                        return v.value.current;
                    });
                    for (let i = 0; i < length - 1 && i < out.length; i += 1) {
                        expect(Number.isNaN(out[i])).toBe(true);
                    }
                },
            ),
            { numRuns: 25 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 40 }), (bars) => {
                const a = harness(bars, bars.length + 1, () => {
                    const v = volatilityStop("slot", { length: 5, multiplier: 2 });
                    return { value: v.value.current, direction: v.direction.current };
                });
                const b = harness(bars, bars.length + 1, () => {
                    const v = volatilityStop("slot", { length: 5, multiplier: 2 });
                    return { value: v.value.current, direction: v.direction.current };
                });
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i].value)) {
                        expect(Number.isNaN(b[i].value)).toBe(true);
                    } else {
                        expect(b[i].value).toBe(a[i].value);
                    }
                    if (Number.isNaN(a[i].direction)) {
                        expect(Number.isNaN(b[i].direction)).toBe(true);
                    } else {
                        expect(b[i].direction).toBe(a[i].direction);
                    }
                }
            }),
            { numRuns: 15 },
        );
    });

    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 40 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    () => volatilityStop("slot", { length: 5, multiplier: 2 }).value.current,
                );
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 20 },
        );
    });

    it("returns the same record identity across all bars", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 30 }), (bars) => {
                const refs: unknown[] = [];
                harness(bars, bars.length + 1, () => {
                    refs.push(volatilityStop("slot", { length: 5, multiplier: 2 }));
                    return null;
                });
                for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
            }),
            { numRuns: 15 },
        );
    });

    it("ticking the last closed bar with its own values reproduces the close output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 8, maxLength: 25 }), (bars) => {
                if (bars.length < 8) return;
                const closedOut = harness(bars, bars.length + 1, () => {
                    const v = volatilityStop("slot", { length: 5, multiplier: 2 });
                    return { value: v.value.current, direction: v.direction.current };
                });
                const expected = closedOut[closedOut.length - 1];
                const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
                    volatilityStop("slot", { length: 5, multiplier: 2 }),
                );
                const last = bars[bars.length - 1];
                const tickHead = tick(ctxRef, last, () => {
                    const v = volatilityStop("slot", { length: 5, multiplier: 2 });
                    return { value: v.value.current, direction: v.direction.current };
                });
                if (Number.isNaN(expected.value)) {
                    expect(Number.isNaN(tickHead.value)).toBe(true);
                } else {
                    expect(tickHead.value).toBeCloseTo(expected.value, 8);
                }
                if (Number.isNaN(expected.direction)) {
                    expect(Number.isNaN(tickHead.direction)).toBe(true);
                } else {
                    expect(tickHead.direction).toBe(expected.direction);
                }
            }),
            { numRuns: 20 },
        );
    });
});
