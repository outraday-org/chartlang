// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";
import { netVolume } from "./netVolume";
import { obv } from "./obv";

describe("ta.netVolume — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 60 }),
                fc.integer({ min: 1, max: 999 }),
                (n, seed) => {
                    const bars = syntheticBars(n, seed);
                    const out = harness(bars, bars.length + 1, () => netVolume("slot").current);
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
                const out = harness(bars, bars.length + 1, () => netVolume("slot").current);
                expect(out[0]).toBe(0);
            }),
            { numRuns: 15 },
        );
    });

    it("output is byte-equal to ta.obv (same math, different name)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 60 }),
                fc.integer({ min: 1, max: 999 }),
                (n, seed) => {
                    const bars = syntheticBars(n, seed);
                    const nv = harness(bars, bars.length + 1, () => netVolume("slot").current);
                    const ov = harness(bars, bars.length + 1, () => obv("slot").current);
                    expect(hashFloat64Array(nv)).toBe(hashFloat64Array(ov));
                },
            ),
            { numRuns: 15 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 40 }),
                fc.integer({ min: 1, max: 999 }),
                (n, seed) => {
                    const bars = syntheticBars(n, seed);
                    const a = harness(bars, bars.length + 1, () => netVolume("slot").current);
                    const b = harness(bars, bars.length + 1, () => netVolume("slot").current);
                    for (let i = 0; i < a.length; i += 1) expect(b[i]).toBe(a[i]);
                },
            ),
            { numRuns: 15 },
        );
    });
});
