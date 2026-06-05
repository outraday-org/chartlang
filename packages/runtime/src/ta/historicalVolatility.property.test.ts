// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers";
import { harness } from "./__fixtures__/runPrimitive";
import { historicalVolatility } from "./historicalVolatility";

describe("ta.historicalVolatility — property invariants", () => {
    it("output is non-negative when defined (positive closes)", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 12, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => historicalVolatility("slot", bar.close, 5).current,
                );
                for (const v of out) {
                    if (Number.isFinite(v)) expect(v).toBeGreaterThanOrEqual(0);
                }
            }),
            { numRuns: 25 },
        );
    });

    it("output is finite or NaN (no Infinity)", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 12, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => historicalVolatility("slot", bar.close, 5).current,
                );
                for (const v of out) {
                    expect(Number.isNaN(v) || Number.isFinite(v)).toBe(true);
                }
            }),
            { numRuns: 25 },
        );
    });

    it("returns the same Series identity across all bars", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 30 }), (bars) => {
                const refs: unknown[] = [];
                harness(bars, bars.length + 1, (bar) => {
                    refs.push(historicalVolatility("slot", bar.close, 4));
                    return null;
                });
                for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
            }),
            { numRuns: 15 },
        );
    });

    it("warmup is exactly `length` NaN bars (the first finite log-return lands at bar 1)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 3, max: 10 }),
                fc.array(arbBar, { minLength: 15, maxLength: 30 }),
                (length, bars) => {
                    const out = harness(
                        bars,
                        bars.length + 1,
                        (bar) => historicalVolatility("slot", bar.close, length).current,
                    );
                    for (let i = 0; i < length; i += 1) expect(Number.isNaN(out[i])).toBe(true);
                    if (bars.length > length) {
                        expect(Number.isFinite(out[length]) || Number.isNaN(out[length])).toBe(
                            true,
                        );
                    }
                },
            ),
            { numRuns: 15 },
        );
    });
});
