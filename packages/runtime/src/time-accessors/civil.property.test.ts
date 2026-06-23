// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { civilFromDays, daysFromCivil, mod, splitEpoch } from "./civil.js";

// ~±2700 years around the epoch — well past both era boundaries and the
// pre-epoch sign branches, comfortably inside Float64 integer precision.
const dayCount = fc.integer({ min: -1_000_000, max: 1_000_000 });

describe("civil round-trips (property)", () => {
    it("daysFromCivil ∘ civilFromDays is the identity over days", () => {
        fc.assert(
            fc.property(dayCount, (z) => {
                const { y, m, d } = civilFromDays(z);
                expect(daysFromCivil(y, m, d)).toBe(z);
            }),
        );
    });

    it("civilFromDays always yields an in-range month and day", () => {
        fc.assert(
            fc.property(dayCount, (z) => {
                const { m, d } = civilFromDays(z);
                expect(m).toBeGreaterThanOrEqual(1);
                expect(m).toBeLessThanOrEqual(12);
                expect(d).toBeGreaterThanOrEqual(1);
                expect(d).toBeLessThanOrEqual(31);
            }),
        );
    });

    it("splitEpoch dow tracks the day count modulo 7", () => {
        fc.assert(
            fc.property(dayCount, fc.integer({ min: 0, max: 86_399 }), (z, secondsOfDay) => {
                const ms = z * 86_400_000 + secondsOfDay * 1000;
                expect(splitEpoch(ms, 0).dow).toBe(mod(z + 4, 7));
            }),
        );
    });
});
