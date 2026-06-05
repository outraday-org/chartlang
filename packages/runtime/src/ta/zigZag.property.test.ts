// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers";
import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { zigZag } from "./zigZag";

describe("ta.zigZag — property invariants", () => {
    it("direction ∈ {+1, -1, NaN} on every bar", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 50 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => {
                    const z = zigZag("slot", { deviation: 5, depth: 5 });
                    return z.direction.current;
                });
                for (const d of out) {
                    expect(d === 1 || d === -1 || Number.isNaN(d)).toBe(true);
                }
            }),
            { numRuns: 25 },
        );
    });

    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 40 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => {
                    const z = zigZag("slot");
                    return z.value.current;
                });
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
                    refs.push(zigZag("slot"));
                    return null;
                });
                for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
            }),
            { numRuns: 15 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 30 }), (bars) => {
                const a = harness(bars, bars.length + 1, () => {
                    const z = zigZag("slot", { deviation: 5, depth: 5 });
                    return { value: z.value.current, direction: z.direction.current };
                });
                const b = harness(bars, bars.length + 1, () => {
                    const z = zigZag("slot", { deviation: 5, depth: 5 });
                    return { value: z.value.current, direction: z.direction.current };
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

    it("bar 0 always emits NaN/NaN (no pivot yet)", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 30 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => {
                    const z = zigZag("slot");
                    return { value: z.value.current, direction: z.direction.current };
                });
                expect(Number.isNaN(out[0].value)).toBe(true);
                expect(Number.isNaN(out[0].direction)).toBe(true);
            }),
            { numRuns: 20 },
        );
    });

    it("ticking the last closed bar with its own values reproduces the close output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 8, maxLength: 25 }), (bars) => {
                if (bars.length < 8) return;
                const closedOut = harness(bars, bars.length + 1, () => {
                    const z = zigZag("slot", { deviation: 5, depth: 5 });
                    return { value: z.value.current, direction: z.direction.current };
                });
                const expected = closedOut[closedOut.length - 1];
                const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
                    zigZag("slot", { deviation: 5, depth: 5 }),
                );
                const last = bars[bars.length - 1];
                const tickHead = tick(ctxRef, last, () => {
                    const z = zigZag("slot", { deviation: 5, depth: 5 });
                    return { value: z.value.current, direction: z.direction.current };
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
