// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { chaikinOsc } from "./chaikinOsc.js";

describe("ta.chaikinOsc — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 60 }),
                fc.integer({ min: 1, max: 999 }),
                (n, seed) => {
                    const bars = syntheticBars(n, seed);
                    const out = harness(bars, bars.length + 1, () => chaikinOsc("slot").current);
                    expect(out.length).toBe(bars.length);
                },
            ),
            { numRuns: 20 },
        );
    });

    it("warmup respects slowLength: bars 0..slowLength-2 are NaN", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 3, max: 15 }),
                fc.integer({ min: 1, max: 999 }),
                (slow, seed) => {
                    const bars = syntheticBars(slow + 5, seed);
                    const out = harness(
                        bars,
                        bars.length + 1,
                        () => chaikinOsc("slot", { fastLength: 2, slowLength: slow }).current,
                    );
                    for (let i = 0; i < slow - 1; i += 1) expect(Number.isNaN(out[i])).toBe(true);
                    expect(Number.isFinite(out[slow - 1])).toBe(true);
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
                    const a = harness(bars, bars.length + 1, () => chaikinOsc("slot").current);
                    const b = harness(bars, bars.length + 1, () => chaikinOsc("slot").current);
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
