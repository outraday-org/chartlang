// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers.js";
import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { pivotsHighLow } from "./pivotsHighLow.js";

describe("ta.pivotsHighLow — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 40 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => {
                    const p = pivotsHighLow("slot", { leftLength: 2, rightLength: 2 });
                    return p.high.current;
                });
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 20 },
        );
    });

    it("first leftLength + rightLength bars are NaN at both outputs (warmup)", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 40 }),
                fc.integer({ min: 1, max: 4 }),
                fc.integer({ min: 1, max: 4 }),
                (bars, leftLength, rightLength) => {
                    const windowSize = leftLength + rightLength + 1;
                    const out = harness(bars, bars.length + 1, () => {
                        const p = pivotsHighLow("slot", { leftLength, rightLength });
                        return { high: p.high.current, low: p.low.current };
                    });
                    for (let i = 0; i < windowSize - 1 && i < out.length; i += 1) {
                        expect(Number.isNaN(out[i].high)).toBe(true);
                        expect(Number.isNaN(out[i].low)).toBe(true);
                    }
                },
            ),
            { numRuns: 25 },
        );
    });

    it("output values ∈ NaN ∪ bar.high / bar.low at the centre bar", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 30 }), (bars) => {
                const leftLength = 2;
                const rightLength = 2;
                const windowSize = leftLength + rightLength + 1;
                const out = harness(bars, bars.length + 1, () => {
                    const p = pivotsHighLow("slot", { leftLength, rightLength });
                    return { high: p.high.current, low: p.low.current };
                });
                for (let t = windowSize - 1; t < out.length; t += 1) {
                    const centreIdx = t - rightLength;
                    const expectedHigh = bars[centreIdx].high;
                    const expectedLow = bars[centreIdx].low;
                    if (!Number.isNaN(out[t].high)) {
                        expect(out[t].high).toBeCloseTo(expectedHigh, 10);
                    }
                    if (!Number.isNaN(out[t].low)) {
                        expect(out[t].low).toBeCloseTo(expectedLow, 10);
                    }
                }
            }),
            { numRuns: 20 },
        );
    });

    it("returns the same record identity across all bars", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 30 }), (bars) => {
                const refs: unknown[] = [];
                harness(bars, bars.length + 1, () => {
                    refs.push(pivotsHighLow("slot"));
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
                    const p = pivotsHighLow("slot", { leftLength: 3, rightLength: 3 });
                    return { high: p.high.current, low: p.low.current };
                });
                const b = harness(bars, bars.length + 1, () => {
                    const p = pivotsHighLow("slot", { leftLength: 3, rightLength: 3 });
                    return { high: p.high.current, low: p.low.current };
                });
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i].high)) {
                        expect(Number.isNaN(b[i].high)).toBe(true);
                    } else {
                        expect(b[i].high).toBe(a[i].high);
                    }
                    if (Number.isNaN(a[i].low)) {
                        expect(Number.isNaN(b[i].low)).toBe(true);
                    } else {
                        expect(b[i].low).toBe(a[i].low);
                    }
                }
            }),
            { numRuns: 15 },
        );
    });

    it("ticking the last closed bar with its own values reproduces the close output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 8, maxLength: 25 }), (bars) => {
                if (bars.length < 8) return;
                const closedOut = harness(bars, bars.length + 1, () => {
                    const p = pivotsHighLow("slot", { leftLength: 2, rightLength: 2 });
                    return { high: p.high.current, low: p.low.current };
                });
                const expected = closedOut[closedOut.length - 1];
                const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
                    pivotsHighLow("slot", { leftLength: 2, rightLength: 2 }),
                );
                const last = bars[bars.length - 1];
                const tickHead = tick(ctxRef, last, () => {
                    const p = pivotsHighLow("slot", { leftLength: 2, rightLength: 2 });
                    return { high: p.high.current, low: p.low.current };
                });
                if (Number.isNaN(expected.high)) {
                    expect(Number.isNaN(tickHead.high)).toBe(true);
                } else {
                    expect(tickHead.high).toBeCloseTo(expected.high, 8);
                }
                if (Number.isNaN(expected.low)) {
                    expect(Number.isNaN(tickHead.low)).toBe(true);
                } else {
                    expect(tickHead.low).toBeCloseTo(expected.low, 8);
                }
            }),
            { numRuns: 20 },
        );
    });
});
