// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers.js";
import { harness } from "./__fixtures__/runPrimitive.js";
import { ema } from "./ema.js";
import { computeEmaOfFloat64 } from "./lib/emaFloat64.js";

describe("ta.ema — property invariants", () => {
    it("output length grows by 1 per close", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => ema("slot", bar.close, 5).current,
                );
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 25 },
        );
    });

    it("warmup is length-1 NaN slots", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 20, maxLength: 50 }),
                fc.integer({ min: 1, max: 10 }),
                (bars, length) => {
                    const out = harness(
                        bars,
                        bars.length + 1,
                        (bar) => ema("slot", bar.close, length).current,
                    );
                    for (let i = 0; i < length - 1 && i < out.length; i += 1) {
                        expect(Number.isNaN(out[i])).toBe(true);
                    }
                },
            ),
            { numRuns: 25 },
        );
    });

    it("incremental matches the full recompute within 1e-8", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 20, maxLength: 60 }), (bars) => {
                const closes = new Float64Array(bars.map((b) => b.close));
                const expected = computeEmaOfFloat64(closes, 5);
                const actual = harness(
                    bars,
                    bars.length + 1,
                    (bar) => ema("slot", bar.close, 5).current,
                );
                for (let i = 0; i < bars.length; i += 1) {
                    if (Number.isNaN(expected[i])) expect(Number.isNaN(actual[i])).toBe(true);
                    else expect(actual[i]).toBeCloseTo(expected[i], 8);
                }
            }),
            { numRuns: 25 },
        );
    });

    it("determinism", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 30 }), (bars) => {
                const a = harness(
                    bars,
                    bars.length + 1,
                    (bar) => ema("slot", bar.close, 3).current,
                );
                const b = harness(
                    bars,
                    bars.length + 1,
                    (bar) => ema("slot", bar.close, 3).current,
                );
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                    else expect(b[i]).toBe(a[i]);
                }
            }),
            { numRuns: 15 },
        );
    });

    it("opts.offset: leaves the series unshifted — shifted[i] === unshifted[i] (presentation-only)", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 50 }),
                fc.integer({ min: -5, max: 5 }).filter((o) => o !== 0),
                (bars, offset) => {
                    const unshifted = harness(
                        bars,
                        bars.length + 1,
                        (bar) => ema("slot", bar.close, 4).current,
                    );
                    const shifted = harness(
                        bars,
                        bars.length + 1,
                        (bar) => ema("slot", bar.close, 4, { offset }).current,
                    );
                    for (let i = 0; i < bars.length; i += 1) {
                        const u = unshifted[i];
                        const s = shifted[i];
                        if (Number.isNaN(u)) expect(Number.isNaN(s)).toBe(true);
                        else expect(s).toBeCloseTo(u, 12);
                    }
                },
            ),
            { numRuns: 20 },
        );
    });
});
