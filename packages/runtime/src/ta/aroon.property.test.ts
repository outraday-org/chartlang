// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { aroon } from "./aroon";
import { arbBar } from "./__fixtures__/propertyHelpers";
import { harness } from "./__fixtures__/runPrimitive";

describe("ta.aroon — property invariants", () => {
    it("up ∈ [0, 100] and down ∈ [0, 100] where defined", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 60 }),
                fc.integer({ min: 1, max: 10 }),
                (bars, length) => {
                    const out = harness(bars, bars.length + 1, () => {
                        const r = aroon("slot", length);
                        return { up: r.up.current, down: r.down.current };
                    });
                    for (const { up, down } of out) {
                        if (Number.isFinite(up)) {
                            expect(up).toBeGreaterThanOrEqual(0);
                            expect(up).toBeLessThanOrEqual(100);
                        }
                        if (Number.isFinite(down)) {
                            expect(down).toBeGreaterThanOrEqual(0);
                            expect(down).toBeLessThanOrEqual(100);
                        }
                    }
                },
            ),
            { numRuns: 30 },
        );
    });

    it("warmup: first `length` outputs are NaN with finite inputs", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 50 }),
                fc.integer({ min: 1, max: 8 }),
                (bars, length) => {
                    const out = harness(bars, bars.length + 1, () => {
                        const r = aroon("slot", length);
                        return r.up.current;
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

    it("output length equals input length for both up and down series", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 40 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => {
                    const r = aroon("slot", 5);
                    return { up: r.up.current, down: r.down.current };
                });
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 25 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 40 }), (bars) => {
                const a = harness(bars, bars.length + 1, () => {
                    const r = aroon("slot", 5);
                    return { up: r.up.current, down: r.down.current };
                });
                const b = harness(bars, bars.length + 1, () => {
                    const r = aroon("slot", 5);
                    return { up: r.up.current, down: r.down.current };
                });
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i].up)) expect(Number.isNaN(b[i].up)).toBe(true);
                    else expect(b[i].up).toBe(a[i].up);
                    if (Number.isNaN(a[i].down)) expect(Number.isNaN(b[i].down)).toBe(true);
                    else expect(b[i].down).toBe(a[i].down);
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
                    refs.push(aroon("slot", 5));
                    return null;
                });
                for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
            }),
            { numRuns: 15 },
        );
    });
});
