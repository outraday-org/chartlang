// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { pvi } from "./pvi.js";

describe("ta.pvi — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 60 }),
                fc.integer({ min: 1, max: 999 }),
                (n, seed) => {
                    const bars = syntheticBars(n, seed);
                    const out = harness(bars, bars.length + 1, () => pvi("slot").current);
                    expect(out.length).toBe(bars.length);
                },
            ),
            { numRuns: 20 },
        );
    });

    it("first bar always emits the 1000 seed (@anchors seedValue)", () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 999 }), (seed) => {
                const bars = syntheticBars(1, seed);
                const out = harness(bars, bars.length + 1, () => pvi("slot").current);
                expect(out[0]).toBe(1000);
            }),
            { numRuns: 20 },
        );
    });

    it("matches the brute-force recurrence (higher-volume-only updates)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 40 }),
                fc.integer({ min: 1, max: 999 }),
                (n, seed) => {
                    const bars = syntheticBars(n, seed);
                    const out = harness(bars, bars.length + 1, () => pvi("slot").current);
                    let expected = 1000;
                    expect(out[0]).toBe(1000);
                    for (let i = 1; i < bars.length; i += 1) {
                        const prev = bars[i - 1];
                        const cur = bars[i];
                        if (cur.volume > prev.volume && prev.close !== 0) {
                            expected = expected * (1 + (cur.close - prev.close) / prev.close);
                        }
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
                    const a = harness(bars, bars.length + 1, () => pvi("slot").current);
                    const b = harness(bars, bars.length + 1, () => pvi("slot").current);
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
