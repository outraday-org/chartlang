// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { computeMaOfFloat64 } from "./lib/computeMaOfFloat64.js";
import { maRibbon, maRibbonOutputKeys } from "./maRibbon.js";

const arbBar = fc
    .tuple(fc.double({ min: 1, max: 1000, noNaN: true }), fc.integer({ min: 0, max: 60_000 }))
    .map(
        ([close, dt], _i): Bar => ({
            time: 1_700_000_000_000 + dt,
            open: close,
            high: close,
            low: close,
            close,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }),
    );

describe("ta.maRibbon — property invariants", () => {
    it("each output's length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const captured: number[] = [];
                harness(bars, bars.length + 1, (bar) => {
                    const r = maRibbon("slot", bar.close, { lengths: [5, 10], maType: "sma" });
                    captured.push(r.ma_5.current);
                    return null;
                });
                expect(captured.length).toBe(bars.length);
            }),
            { numRuns: 30 },
        );
    });

    it("output keys exactly match maRibbonOutputKeys(opts)", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 40 }),
                fc.uniqueArray(fc.integer({ min: 2, max: 20 }), { minLength: 1, maxLength: 5 }),
                (bars, lengths) => {
                    let observed: ReadonlyArray<string> | null = null;
                    harness(bars, bars.length + 1, (bar) => {
                        const r = maRibbon("slot", bar.close, { lengths, maType: "sma" });
                        observed = Object.keys(r);
                        return null;
                    });
                    expect(observed).toEqual(maRibbonOutputKeys({ lengths }));
                },
            ),
            { numRuns: 20 },
        );
    });

    it("incremental output equals computeMaOfFloat64 per length within 1e-8", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 30, maxLength: 60 }),
                fc.constantFrom("sma", "ema", "wma", "smma" as const),
                (bars, maType) => {
                    const closes = new Float64Array(bars.map((b) => b.close));
                    const lengths = [5, 10] as const;
                    const captured: Record<string, number[]> = { ma_5: [], ma_10: [] };
                    harness(bars, bars.length + 1, (bar) => {
                        const r = maRibbon("slot", bar.close, {
                            lengths: [...lengths],
                            maType,
                        });
                        captured.ma_5.push(r.ma_5.current);
                        captured.ma_10.push(r.ma_10.current);
                        return null;
                    });
                    for (const length of lengths) {
                        const key = `ma_${length}`;
                        const expected = computeMaOfFloat64(maType, closes, length);
                        for (let i = 0; i < bars.length; i += 1) {
                            if (Number.isNaN(expected[i])) {
                                expect(Number.isNaN(captured[key][i])).toBe(true);
                            } else {
                                expect(captured[key][i]).toBeCloseTo(expected[i], 8);
                            }
                        }
                    }
                },
            ),
            { numRuns: 20 },
        );
    });

    it("determinism: same input → identical outputs across each ma_<length>", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 20, maxLength: 50 }), (bars) => {
                const captureRun = (): { a: number[]; b: number[] } => {
                    const a: number[] = [];
                    const b: number[] = [];
                    harness(bars, bars.length + 1, (bar) => {
                        const r = maRibbon("slot", bar.close, {
                            lengths: [4, 8],
                            maType: "sma",
                        });
                        a.push(r.ma_4.current);
                        b.push(r.ma_8.current);
                        return null;
                    });
                    return { a, b };
                };
                const r1 = captureRun();
                const r2 = captureRun();
                for (let i = 0; i < r1.a.length; i += 1) {
                    if (Number.isNaN(r1.a[i])) expect(Number.isNaN(r2.a[i])).toBe(true);
                    else expect(r2.a[i]).toBe(r1.a[i]);
                    if (Number.isNaN(r1.b[i])) expect(Number.isNaN(r2.b[i])).toBe(true);
                    else expect(r2.b[i]).toBe(r1.b[i]);
                }
            }),
            { numRuns: 15 },
        );
    });
});
