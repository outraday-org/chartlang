// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { formatTick, niceTicks, tickStep } from "./axis.js";

describe("niceTicks", () => {
    it("spans the demo price band on a nice grid", () => {
        // raw step 12 → norm 1.2 → step 20.
        expect(niceTicks(100, 160, 5)).toEqual([100, 120, 140, 160]);
    });

    it("snaps the step through each 1 / 2 / 5 tier", () => {
        // raw step 12 → norm 1.2 → step 20 (the >1 tier).
        expect(niceTicks(0, 60, 5)).toEqual([0, 20, 40, 60]);
        // raw step 3 → norm 3 → step 5 (the >2 tier).
        expect(niceTicks(0, 15, 5)).toEqual([0, 5, 10, 15]);
        // raw step 6 → norm 6 → step 10 (the >5 tier).
        expect(niceTicks(0, 30, 5)).toEqual([0, 10, 20, 30]);
        // raw step 10 → norm 1.0 → step 10 (the ≤1 / else tier).
        expect(niceTicks(0, 50, 5)).toEqual([0, 10, 20, 30, 40, 50]);
    });

    it("does not emit a label below the range start", () => {
        const ticks = niceTicks(103, 158, 5);
        expect(ticks[0]).toBeGreaterThanOrEqual(103);
        expect(ticks.at(-1)).toBeLessThanOrEqual(158);
    });

    it("returns no ticks for a degenerate range", () => {
        expect(niceTicks(Number.NaN, 10, 5)).toEqual([]);
        expect(niceTicks(10, 10, 5)).toEqual([]);
        expect(niceTicks(20, 10, 5)).toEqual([]);
        expect(niceTicks(0, 10, 0)).toEqual([]);
    });
});

describe("formatTick", () => {
    it("drops decimals for an integer step", () => {
        expect(formatTick(120, 10)).toBe("120");
    });

    it("keeps decimals scaled to a sub-unit step", () => {
        expect(formatTick(1.2345, 0.5)).toBe("1.2");
        expect(formatTick(1.23, 0.05)).toBe("1.23");
    });
});

describe("tickStep", () => {
    it("returns the adjacent-tick spacing", () => {
        expect(tickStep([100, 110, 120])).toBe(10);
    });

    it("returns 0 when there are fewer than two ticks", () => {
        expect(tickStep([])).toBe(0);
        expect(tickStep([100])).toBe(0);
    });
});
