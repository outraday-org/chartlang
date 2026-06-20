// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { FIB_LEVELS, formatLevel } from "./fibLevels.js";

describe("FIB_LEVELS", () => {
    it("is the canonical 13-element ratio array", () => {
        expect(FIB_LEVELS).toEqual([
            0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272,
            // biome-ignore lint/suspicious/noApproximativeNumericConstant: canonical fib ratio, not √2.
            1.414,
            1.618, 2.0, 2.618, 4.236,
        ]);
    });

    it("is frozen so decomposers cannot mutate the shared array", () => {
        expect(Object.isFrozen(FIB_LEVELS)).toBe(true);
    });

    it("is monotonic ascending", () => {
        for (let i = 1; i < FIB_LEVELS.length; i++) {
            expect(FIB_LEVELS[i]).toBeGreaterThan(FIB_LEVELS[i - 1]);
        }
    });
});

describe("formatLevel", () => {
    it("renders integer ratios with one decimal place", () => {
        expect(formatLevel(0)).toBe("0.0");
        expect(formatLevel(1)).toBe("1.0");
        expect(formatLevel(2)).toBe("2.0");
    });

    it("renders fractional ratios with three decimal places", () => {
        expect(formatLevel(0.236)).toBe("0.236");
        expect(formatLevel(0.618)).toBe("0.618");
        expect(formatLevel(1.272)).toBe("1.272");
    });
});
