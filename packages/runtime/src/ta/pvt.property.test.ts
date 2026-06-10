// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { pvt } from "./pvt.js";

describe("ta.pvt — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 60 }),
                fc.integer({ min: 1, max: 999 }),
                (n, seed) => {
                    const bars = syntheticBars(n, seed);
                    const out = harness(bars, bars.length + 1, () => pvt("slot").current);
                    expect(out.length).toBe(bars.length);
                },
            ),
            { numRuns: 20 },
        );
    });

    it("first bar always emits 0", () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 999 }), (seed) => {
                const bars = syntheticBars(1, seed);
                const out = harness(bars, bars.length + 1, () => pvt("slot").current);
                expect(out[0]).toBe(0);
            }),
            { numRuns: 15 },
        );
    });

    it("matches brute-force cumulative against the reference recurrence", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 40 }),
                fc.integer({ min: 1, max: 999 }),
                (n, seed) => {
                    const bars = syntheticBars(n, seed);
                    const out = harness(bars, bars.length + 1, () => pvt("slot").current);
                    let expected = 0;
                    expect(out[0]).toBe(0);
                    for (let i = 1; i < bars.length; i += 1) {
                        const prev = bars[i - 1].close;
                        if (prev === 0) {
                            // Skip: zero prevClose path emits NaN and
                            // carries cum forward. Synthetic walk starts
                            // at 100 and drifts ±1 so prev hits 0 only in
                            // pathological corners; the unit tests pin
                            // the path explicitly.
                            continue;
                        }
                        const contribution = (bars[i].volume * (bars[i].close - prev)) / prev;
                        expected += contribution;
                        expect(out[i]).toBeCloseTo(expected, 6);
                    }
                },
            ),
            { numRuns: 20 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 40 }),
                fc.integer({ min: 1, max: 999 }),
                (n, seed) => {
                    const bars = syntheticBars(n, seed);
                    const a = harness(bars, bars.length + 1, () => pvt("slot").current);
                    const b = harness(bars, bars.length + 1, () => pvt("slot").current);
                    for (let i = 0; i < a.length; i += 1) {
                        if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                        else expect(b[i]).toBe(a[i]);
                    }
                },
            ),
            { numRuns: 15 },
        );
    });
});
