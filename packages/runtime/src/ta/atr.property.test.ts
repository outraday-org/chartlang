// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers.js";
import { harness } from "./__fixtures__/runPrimitive.js";
import { atr } from "./atr.js";
import { computeAtrSeries } from "./lib/trSeries.js";

describe("ta.atr — property invariants", () => {
    it("ATR ≥ 0 where defined", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 20, maxLength: 60 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => atr("slot", 5).current);
                for (const v of out) {
                    if (Number.isFinite(v)) expect(v).toBeGreaterThanOrEqual(0);
                }
            }),
            { numRuns: 25 },
        );
    });

    it("incremental matches the full recompute within 1e-6", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 20, maxLength: 60 }), (bars) => {
                const expected = computeAtrSeries(bars, 5).atr;
                const actual = harness(bars, bars.length + 1, () => atr("slot", 5).current);
                for (let i = 0; i < bars.length; i += 1) {
                    if (Number.isNaN(expected[i])) expect(Number.isNaN(actual[i])).toBe(true);
                    else expect(actual[i]).toBeCloseTo(expected[i], 6);
                }
            }),
            { numRuns: 20 },
        );
    });

    it("opts.offset: leaves the series unshifted — shifted[i] === unshifted[i] (presentation-only)", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 20, maxLength: 60 }),
                fc.integer({ min: -5, max: 5 }).filter((o) => o !== 0),
                (bars, offset) => {
                    const unshifted = harness(bars, bars.length + 1, () => atr("slot", 5).current);
                    const shifted = harness(
                        bars,
                        bars.length + 1,
                        () => atr("slot", 5, { offset }).current,
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
