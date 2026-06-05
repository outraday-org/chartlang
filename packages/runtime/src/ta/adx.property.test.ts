// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { adx } from "./adx";
import { adxFromDi } from "./lib/adxFromDi";
import { wilderDirectional } from "./lib/wilderDirectional";
import { arbBar } from "./__fixtures__/propertyHelpers";
import { harness } from "./__fixtures__/runPrimitive";

// Floating-point slack for the [0, 100] band — Wilder smoothing
// accumulates per-step error on degenerate (flat-window) samples.
const ADX_EPS = 1e-9;

describe("ta.adx — property invariants", () => {
    it("adx ∈ [0, 100] where defined", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 30, maxLength: 80 }),
                fc.integer({ min: 1, max: 8 }),
                (bars, length) => {
                    const out = harness(
                        bars,
                        bars.length + 1,
                        () => adx("slot", length, { smoothing: length }).current,
                    );
                    for (const v of out) {
                        if (Number.isFinite(v)) {
                            expect(v).toBeGreaterThanOrEqual(-ADX_EPS);
                            expect(v).toBeLessThanOrEqual(100 + ADX_EPS);
                        }
                    }
                },
            ),
            { numRuns: 20 },
        );
    });

    it("warmup: first `length + smoothing - 1` outputs are NaN with finite inputs", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 30, maxLength: 60 }),
                fc.integer({ min: 1, max: 6 }),
                fc.integer({ min: 1, max: 6 }),
                (bars, length, smoothing) => {
                    const out = harness(
                        bars,
                        bars.length + 1,
                        () => adx("slot", length, { smoothing }).current,
                    );
                    const warmup = length + smoothing - 1;
                    for (let i = 0; i < warmup && i < out.length; i += 1) {
                        expect(Number.isNaN(out[i])).toBe(true);
                    }
                    if (out.length > warmup) {
                        expect(Number.isFinite(out[warmup])).toBe(true);
                    }
                },
            ),
            { numRuns: 20 },
        );
    });

    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 40 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    () => adx("slot", 5, { smoothing: 5 }).current,
                );
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 20 },
        );
    });

    it("incremental output equals adxFromDi(wilderDirectional(...)) within 1e-8", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 30, maxLength: 60 }), (bars) => {
                const highs = new Float64Array(bars.map((b) => b.high));
                const lows = new Float64Array(bars.map((b) => b.low));
                const closes = new Float64Array(bars.map((b) => b.close));
                const { plusDi, minusDi } = wilderDirectional(highs, lows, closes, 5);
                const expected = adxFromDi(plusDi, minusDi, 5);
                const actual = harness(
                    bars,
                    bars.length + 1,
                    () => adx("slot", 5, { smoothing: 5 }).current,
                );
                for (let i = 0; i < bars.length; i += 1) {
                    if (Number.isNaN(expected[i])) {
                        expect(Number.isNaN(actual[i])).toBe(true);
                    } else {
                        expect(actual[i]).toBeCloseTo(expected[i], 8);
                    }
                }
            }),
            { numRuns: 20 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 15, maxLength: 50 }), (bars) => {
                const a = harness(
                    bars,
                    bars.length + 1,
                    () => adx("slot", 5, { smoothing: 5 }).current,
                );
                const b = harness(
                    bars,
                    bars.length + 1,
                    () => adx("slot", 5, { smoothing: 5 }).current,
                );
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                    else expect(b[i]).toBe(a[i]);
                }
            }),
            { numRuns: 15 },
        );
    });
});
