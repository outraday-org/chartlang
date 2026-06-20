// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { GANN_FAN_LABELS, GANN_FAN_RATIOS, GANN_LEVELS, formatGannRatio } from "./gannLevels.js";

describe("gannLevels", () => {
    it("GANN_LEVELS is the frozen 1/4 subdivision set", () => {
        expect(GANN_LEVELS).toEqual([0, 0.25, 0.5, 0.75, 1]);
        expect(Object.isFrozen(GANN_LEVELS)).toBe(true);
    });

    it("GANN_FAN_RATIOS / labels are the frozen 9-entry co-indexed tuples", () => {
        expect(GANN_FAN_RATIOS).toHaveLength(9);
        expect(GANN_FAN_LABELS).toHaveLength(9);
        expect(Object.isFrozen(GANN_FAN_RATIOS)).toBe(true);
        expect(Object.isFrozen(GANN_FAN_LABELS)).toBe(true);
    });

    it("formatGannRatio renders >= 1 ratios as 1x<n>", () => {
        expect(formatGannRatio(1)).toBe("1x1");
        expect(formatGannRatio(2)).toBe("1x2");
        expect(formatGannRatio(8)).toBe("1x8");
    });

    it("formatGannRatio renders < 1 ratios as <n>x1", () => {
        expect(formatGannRatio(0.5)).toBe("2x1");
        expect(formatGannRatio(0.25)).toBe("4x1");
        expect(formatGannRatio(1 / 3)).toBe("3x1");
    });
});
