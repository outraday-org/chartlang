// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { mfi } from "./mfi";

describe("ta.mfi — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 60 }),
                fc.integer({ min: 1, max: 999 }),
                (n, seed) => {
                    const bars = syntheticBars(n, seed);
                    const out = harness(bars, bars.length + 1, () => mfi("slot", 14).current);
                    expect(out.length).toBe(bars.length);
                },
            ),
            { numRuns: 20 },
        );
    });

    it("range invariant: every defined output is in [0, 100]", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 20, max: 80 }),
                fc.integer({ min: 1, max: 999 }),
                fc.integer({ min: 3, max: 14 }),
                (n, seed, length) => {
                    const bars = syntheticBars(n, seed);
                    const out = harness(bars, bars.length + 1, () => mfi("slot", length).current);
                    for (const v of out) {
                        if (!Number.isNaN(v)) {
                            // Allow a 1e-9 fp epsilon either side — the
                            // 100·pos/(pos+neg) ratio can drift slightly
                            // past the [0, 100] boundary on edge cases.
                            expect(v).toBeGreaterThanOrEqual(-1e-9);
                            expect(v).toBeLessThanOrEqual(100 + 1e-9);
                        }
                    }
                },
            ),
            { numRuns: 20 },
        );
    });

    it("warmup respects length: bars 0..length-1 are NaN", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 10 }),
                fc.integer({ min: 1, max: 999 }),
                (length, seed) => {
                    const bars = syntheticBars(length + 6, seed);
                    const out = harness(bars, bars.length + 1, () => mfi("slot", length).current);
                    for (let i = 0; i < length; i += 1) expect(Number.isNaN(out[i])).toBe(true);
                },
            ),
            { numRuns: 15 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 5, max: 40 }),
                fc.integer({ min: 1, max: 999 }),
                (n, seed) => {
                    const bars = syntheticBars(n, seed);
                    const a = harness(bars, bars.length + 1, () => mfi("slot", 5).current);
                    const b = harness(bars, bars.length + 1, () => mfi("slot", 5).current);
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
