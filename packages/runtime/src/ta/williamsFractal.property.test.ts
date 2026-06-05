// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { williamsFractal } from "./williamsFractal";
import { arbBar } from "./__fixtures__/propertyHelpers";
import { harness } from "./__fixtures__/runPrimitive";

describe("ta.williamsFractal — property invariants", () => {
    it("up / down output is either NaN or finite (price level, never boolean)", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 60 }),
                fc.integer({ min: 1, max: 5 }),
                (bars, length) => {
                    const out = harness(bars, bars.length + 1, () => {
                        const f = williamsFractal("slot", { length });
                        return { up: f.up.current, down: f.down.current };
                    });
                    for (const { up, down } of out) {
                        // No boolean values — must be number.
                        expect(typeof up).toBe("number");
                        expect(typeof down).toBe("number");
                    }
                },
            ),
            { numRuns: 20 },
        );
    });

    it("warmup: first `2 · length` outputs are NaN with finite inputs", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 15, maxLength: 50 }),
                fc.integer({ min: 1, max: 5 }),
                (bars, length) => {
                    const out = harness(bars, bars.length + 1, () => {
                        const f = williamsFractal("slot", { length });
                        return f.up.current;
                    });
                    for (let i = 0; i < 2 * length && i < out.length; i += 1) {
                        expect(Number.isNaN(out[i])).toBe(true);
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
                    const f = williamsFractal("slot", { length: 2 });
                    return { up: f.up.current, down: f.down.current };
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
                    const f = williamsFractal("slot", { length: 2 });
                    return { up: f.up.current, down: f.down.current };
                });
                const b = harness(bars, bars.length + 1, () => {
                    const f = williamsFractal("slot", { length: 2 });
                    return { up: f.up.current, down: f.down.current };
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
                    refs.push(williamsFractal("slot"));
                    return null;
                });
                for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
            }),
            { numRuns: 15 },
        );
    });

    it("output at bar t encodes fractal status of bar t − length (centred-window invariant)", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 15, maxLength: 50 }),
                fc.integer({ min: 1, max: 4 }),
                (bars, length) => {
                    const out = harness(bars, bars.length + 1, () => {
                        const f = williamsFractal("slot", { length });
                        return { up: f.up.current, down: f.down.current };
                    });
                    // When out[t].up is finite, it must equal bars[t -
                    // length].high (the centred bar's high).
                    for (let t = 2 * length; t < out.length; t += 1) {
                        if (Number.isFinite(out[t].up)) {
                            expect(out[t].up).toBe(bars[t - length].high);
                        }
                        if (Number.isFinite(out[t].down)) {
                            expect(out[t].down).toBe(bars[t - length].low);
                        }
                    }
                },
            ),
            { numRuns: 20 },
        );
    });
});
