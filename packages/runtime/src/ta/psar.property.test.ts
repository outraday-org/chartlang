// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers.js";
import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { psar } from "./psar.js";

describe("ta.psar — property invariants", () => {
    it("direction ∈ {+1, -1, NaN} on every bar", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => {
                    const p = psar("slot");
                    return p.direction.current;
                });
                for (const d of out) {
                    expect(d === 1 || d === -1 || Number.isNaN(d)).toBe(true);
                }
            }),
            { numRuns: 30 },
        );
    });

    it("sar is finite whenever direction is finite (and vice versa)", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 50 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => {
                    const p = psar("slot");
                    return { sar: p.sar.current, direction: p.direction.current };
                });
                for (const { sar, direction } of out) {
                    if (Number.isFinite(direction)) expect(Number.isFinite(sar)).toBe(true);
                    if (Number.isFinite(sar)) expect(Number.isFinite(direction)).toBe(true);
                }
            }),
            { numRuns: 25 },
        );
    });

    it("warmup: bar 0 is always finite for finite input (seed)", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 30 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => psar("slot").sar.current);
                expect(Number.isFinite(out[0])).toBe(true);
            }),
            { numRuns: 25 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 40 }), (bars) => {
                const a = harness(bars, bars.length + 1, () => {
                    const p = psar("slot");
                    return { sar: p.sar.current, direction: p.direction.current };
                });
                const b = harness(bars, bars.length + 1, () => {
                    const p = psar("slot");
                    return { sar: p.sar.current, direction: p.direction.current };
                });
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i].sar)) expect(Number.isNaN(b[i].sar)).toBe(true);
                    else expect(b[i].sar).toBe(a[i].sar);
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
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 40 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => psar("slot").sar.current);
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 20 },
        );
    });

    it("returns the same record identity across all bars", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 3, maxLength: 30 }), (bars) => {
                const refs: unknown[] = [];
                harness(bars, bars.length + 1, () => {
                    refs.push(psar("slot"));
                    return null;
                });
                for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
            }),
            { numRuns: 15 },
        );
    });

    it("ticking the last closed bar with its own values reproduces the close output", () => {
        // Append-vs-replaceHead equivalence: drive all bars closed,
        // then tick the last bar with its own OHLC. The tick replay
        // re-computes from the snapshot and must match.
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 4, maxLength: 25 }), (bars) => {
                if (bars.length < 4) return;
                const closedOut = harness(bars, bars.length + 1, () => {
                    const p = psar("slot");
                    return { sar: p.sar.current, direction: p.direction.current };
                });
                const expected = closedOut[closedOut.length - 1];
                const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => psar("slot"));
                const last = bars[bars.length - 1];
                const tickHead = tick(ctxRef, last, () => {
                    const p = psar("slot");
                    return { sar: p.sar.current, direction: p.direction.current };
                });
                if (Number.isNaN(expected.sar)) {
                    expect(Number.isNaN(tickHead.sar)).toBe(true);
                } else {
                    expect(tickHead.sar).toBeCloseTo(expected.sar, 8);
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
