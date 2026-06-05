// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers";
import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { supertrend } from "./supertrend";

describe("ta.supertrend — property invariants", () => {
    it("direction ∈ {+1, -1, NaN} on every bar", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 60 }),
                fc.integer({ min: 2, max: 10 }),
                (bars, length) => {
                    const out = harness(bars, bars.length + 1, () => {
                        const s = supertrend("slot", { length, multiplier: 3 });
                        return s.direction.current;
                    });
                    for (const d of out) {
                        expect(d === 1 || d === -1 || Number.isNaN(d)).toBe(true);
                    }
                },
            ),
            { numRuns: 25 },
        );
    });

    it("line is finite whenever direction is finite", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 50 }),
                fc.integer({ min: 2, max: 8 }),
                (bars, length) => {
                    const out = harness(bars, bars.length + 1, () => {
                        const s = supertrend("slot", { length, multiplier: 3 });
                        return { line: s.line.current, direction: s.direction.current };
                    });
                    for (const { line, direction } of out) {
                        if (Number.isFinite(direction)) expect(Number.isFinite(line)).toBe(true);
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
                        const s = supertrend("slot", { length, multiplier: 3 });
                        return s.line.current;
                    });
                    for (let i = 0; i < length - 1 && i < out.length; i += 1) {
                        expect(Number.isNaN(out[i])).toBe(true);
                    }
                    if (out.length >= length) {
                        expect(Number.isFinite(out[length - 1])).toBe(true);
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
                    const s = supertrend("slot", { length: 5, multiplier: 3 });
                    return { line: s.line.current, direction: s.direction.current };
                });
                const b = harness(bars, bars.length + 1, () => {
                    const s = supertrend("slot", { length: 5, multiplier: 3 });
                    return { line: s.line.current, direction: s.direction.current };
                });
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i].line)) expect(Number.isNaN(b[i].line)).toBe(true);
                    else expect(b[i].line).toBe(a[i].line);
                    if (Number.isNaN(a[i].direction)) {
                        expect(Number.isNaN(b[i].direction)).toBe(true);
                    } else expect(b[i].direction).toBe(a[i].direction);
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
                    () => supertrend("slot", { length: 5, multiplier: 3 }).line.current,
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
                    refs.push(supertrend("slot", { length: 5, multiplier: 3 }));
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
                    const s = supertrend("slot", { length: 5, multiplier: 3 });
                    return { line: s.line.current, direction: s.direction.current };
                });
                const expected = closedOut[closedOut.length - 1];
                const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
                    supertrend("slot", { length: 5, multiplier: 3 }),
                );
                const last = bars[bars.length - 1];
                const tickHead = tick(ctxRef, last, () => {
                    const s = supertrend("slot", { length: 5, multiplier: 3 });
                    return { line: s.line.current, direction: s.direction.current };
                });
                if (Number.isNaN(expected.line)) {
                    expect(Number.isNaN(tickHead.line)).toBe(true);
                } else {
                    expect(tickHead.line).toBeCloseTo(expected.line, 8);
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
