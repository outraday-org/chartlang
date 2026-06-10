// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { FIB_LEVELS, formatLevel } from "./fibLevels.js";

describe("FIB_LEVELS", () => {
    it("ships exactly 13 entries", () => {
        expect(FIB_LEVELS.length).toBe(13);
    });

    it("is monotonically non-decreasing", () => {
        for (let i = 1; i < FIB_LEVELS.length; i++) {
            expect(FIB_LEVELS[i]).toBeGreaterThan(FIB_LEVELS[i - 1]);
        }
    });

    it("includes the canonical ratios in order", () => {
        expect([...FIB_LEVELS]).toEqual([
            0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272,
            // biome-ignore lint/suspicious/noApproximativeNumericConstant: canonical fib ratio, not √2.
            1.414,
            1.618, 2.0, 2.618, 4.236,
        ]);
    });

    it("is frozen — consumers cannot mutate the shared array", () => {
        expect(Object.isFrozen(FIB_LEVELS)).toBe(true);
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
        expect(formatLevel(0.382)).toBe("0.382");
        expect(formatLevel(0.5)).toBe("0.500");
        expect(formatLevel(0.618)).toBe("0.618");
        expect(formatLevel(0.786)).toBe("0.786");
        expect(formatLevel(1.272)).toBe("1.272");
        // biome-ignore lint/suspicious/noApproximativeNumericConstant: 1.414 is the canonical fib ratio, not √2.
        expect(formatLevel(1.414)).toBe("1.414");
        expect(formatLevel(1.618)).toBe("1.618");
        expect(formatLevel(2.618)).toBe("2.618");
        expect(formatLevel(4.236)).toBe("4.236");
    });
});
