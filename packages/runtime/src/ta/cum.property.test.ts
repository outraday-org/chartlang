// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers.js";
import { harness } from "./__fixtures__/runPrimitive.js";
import { cum } from "./cum.js";

describe("ta.cum — property invariants", () => {
    it("first-difference identity: cum[t] - cum[t-1] === source[t] (finite sources)", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(bars, bars.length + 1, (bar) => cum("slot", bar.close).current);
                expect(out[0]).toBeCloseTo(bars[0].close, 9);
                for (let i = 1; i < bars.length; i += 1) {
                    expect(out[i] - out[i - 1]).toBeCloseTo(bars[i].close, 9);
                }
            }),
            { numRuns: 30 },
        );
    });

    it("monotonic non-decreasing when the source is non-negative (volume)", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => cum("slot", bar.volume).current,
                );
                for (let i = 1; i < out.length; i += 1) {
                    expect(out[i]).toBeGreaterThanOrEqual(out[i - 1]);
                }
            }),
            { numRuns: 30 },
        );
    });

    it("output length equals input length; every slot is finite (warmup 0)", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 60 }), (bars) => {
                const out = harness(bars, bars.length + 1, (bar) => cum("slot", bar.close).current);
                expect(out.length).toBe(bars.length);
                for (const v of out) expect(Number.isFinite(v)).toBe(true);
            }),
            { numRuns: 25 },
        );
    });
});
