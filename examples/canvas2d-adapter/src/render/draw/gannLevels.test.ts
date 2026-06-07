// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import {
    GANN_FAN_LABELS,
    GANN_FAN_RATIOS,
    GANN_LEVELS,
    formatGannRatio,
} from "./gannLevels";

describe("GANN_LEVELS", () => {
    it("pins the 5 canonical 1/4 subdivisions [0, 0.25, 0.5, 0.75, 1]", () => {
        expect([...GANN_LEVELS]).toEqual([0, 0.25, 0.5, 0.75, 1]);
    });

    it("is frozen so consumers cannot mutate it", () => {
        expect(Object.isFrozen(GANN_LEVELS)).toBe(true);
    });
});

describe("GANN_FAN_RATIOS", () => {
    it("ships 9 canonical Gann angles", () => {
        expect(GANN_FAN_RATIOS).toHaveLength(9);
    });

    it("includes 1×1 / 1×2 / 2×1 / 1×3 / 3×1 / 1×4 / 4×1 / 1×8 / 8×1", () => {
        expect([...GANN_FAN_RATIOS]).toEqual([1, 2, 3, 0.5, 1 / 3, 4, 0.25, 8, 0.125]);
    });

    it("is frozen so consumers cannot mutate it", () => {
        expect(Object.isFrozen(GANN_FAN_RATIOS)).toBe(true);
    });
});

describe("GANN_FAN_LABELS", () => {
    it("matches the GANN_FAN_RATIOS length", () => {
        expect(GANN_FAN_LABELS).toHaveLength(GANN_FAN_RATIOS.length);
    });

    it("pins canonical kebab labels in order", () => {
        expect([...GANN_FAN_LABELS]).toEqual([
            "1x1",
            "1x2",
            "1x3",
            "2x1",
            "3x1",
            "1x4",
            "4x1",
            "1x8",
            "8x1",
        ]);
    });
});

describe("formatGannRatio", () => {
    it("maps 1 -> '1x1'", () => {
        expect(formatGannRatio(1)).toBe("1x1");
    });

    it("maps ratios >= 1 to '1x<n>' via Math.round", () => {
        expect(formatGannRatio(2)).toBe("1x2");
        expect(formatGannRatio(3)).toBe("1x3");
        expect(formatGannRatio(4)).toBe("1x4");
        expect(formatGannRatio(8)).toBe("1x8");
    });

    it("maps ratios < 1 to '<n>x1' via Math.round(1/ratio)", () => {
        expect(formatGannRatio(0.5)).toBe("2x1");
        expect(formatGannRatio(1 / 3)).toBe("3x1");
        expect(formatGannRatio(0.25)).toBe("4x1");
        expect(formatGannRatio(0.125)).toBe("8x1");
    });

    it("agrees with GANN_FAN_LABELS for every GANN_FAN_RATIOS entry", () => {
        for (let i = 0; i < GANN_FAN_RATIOS.length; i++) {
            expect(formatGannRatio(GANN_FAN_RATIOS[i])).toBe(GANN_FAN_LABELS[i]);
        }
    });
});
