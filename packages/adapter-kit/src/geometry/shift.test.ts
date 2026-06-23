// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { timeToX } from "./project.js";
import {
    maxShiftedTime,
    medianBarSpacing,
    projectShiftedX,
    shiftedBarIndex,
    shiftedBarTime,
} from "./shift.js";
import type { Viewport } from "./types.js";

const viewport: Viewport = { xMin: 0, xMax: 30, yMin: 0, yMax: 1, pxWidth: 300, pxHeight: 1 };
const bars = [{ time: 0 }, { time: 10 }, { time: 20 }, { time: 30 }];
const spacing = 10;

describe("medianBarSpacing", () => {
    it("returns 0 for an empty or single-bar run", () => {
        expect(medianBarSpacing([])).toBe(0);
        expect(medianBarSpacing([{ time: 5 }])).toBe(0);
    });

    it("returns the spacing of an evenly spaced run (odd delta count)", () => {
        expect(medianBarSpacing([{ time: 0 }, { time: 10 }, { time: 20 }, { time: 30 }])).toBe(10);
    });

    it("averages the middle two deltas for an even delta count", () => {
        // deltas [10, 30] → median (10 + 30) / 2 = 20
        expect(medianBarSpacing([{ time: 0 }, { time: 10 }, { time: 40 }])).toBe(20);
        // deltas [20, 5, 10] sorted [5, 10, 20] → odd, median 10
        expect(medianBarSpacing([{ time: 0 }, { time: 20 }, { time: 25 }, { time: 35 }])).toBe(10);
    });
});

describe("shiftedBarTime", () => {
    it("returns 0 for an empty bar run", () => {
        expect(shiftedBarTime({ bars: [], bar: 0, xShift: 3, spacing })).toBe(0);
    });

    it("returns the bar's own time for no / zero shift in range", () => {
        expect(shiftedBarTime({ bars, bar: 2, xShift: undefined, spacing })).toBe(20);
        expect(shiftedBarTime({ bars, bar: 2, xShift: 0, spacing })).toBe(20);
    });

    it("maps a negative shift in range to the historical bar's time", () => {
        expect(shiftedBarTime({ bars, bar: 3, xShift: -2, spacing })).toBe(10);
    });

    it("maps a positive shift in range to the later bar's time", () => {
        expect(shiftedBarTime({ bars, bar: 1, xShift: 2, spacing })).toBe(30);
    });

    it("extrapolates past the last bar for a future shift", () => {
        // bar 3 (time 30) shifted +2 → 30 + 2 * 10 = 50
        expect(shiftedBarTime({ bars, bar: 3, xShift: 2, spacing })).toBe(50);
    });

    it("extrapolates before the first bar for a far-past shift", () => {
        // bar 0 (time 0) shifted -2 → 0 + (-2) * 10 = -20
        expect(shiftedBarTime({ bars, bar: 0, xShift: -2, spacing })).toBe(-20);
    });

    it("zero spacing collapses an out-of-range shift to the edge bar's time", () => {
        expect(shiftedBarTime({ bars, bar: 3, xShift: 5, spacing: 0 })).toBe(30);
        expect(shiftedBarTime({ bars, bar: 0, xShift: -5, spacing: 0 })).toBe(0);
    });
});

describe("projectShiftedX", () => {
    it("round-trips to timeToX(point.time) for an unshifted point", () => {
        const x = projectShiftedX({ bars, bar: 1, xShift: undefined, spacing }, viewport);
        expect(x).toBe(timeToX(10, viewport));
    });

    it("projects a shifted point through timeToX of the displaced time", () => {
        const x = projectShiftedX({ bars, bar: 0, xShift: 1, spacing }, viewport);
        expect(x).toBe(timeToX(10, viewport));
    });
});

describe("maxShiftedTime", () => {
    it("returns the seed when no point shifts forward", () => {
        const pts = [{ bar: 1 }, { bar: 2, xShift: 0 }, { bar: 0, xShift: -3 }];
        expect(maxShiftedTime(pts, bars, spacing, 30)).toBe(30);
    });

    it("widens to the largest positive-shift target time", () => {
        const pts = [
            { bar: 2, xShift: 2 },
            { bar: 3, xShift: 1 },
            { bar: 0, xShift: -1 },
        ];
        // bar 2 +2 → time 40; bar 3 +1 → time 40; max is 40, above seed 30
        expect(maxShiftedTime(pts, bars, spacing, 30)).toBe(40);
    });

    it("never returns below the seed", () => {
        const pts = [{ bar: 0, xShift: 1 }];
        // bar 0 +1 → time 10, below seed 30 → seed kept
        expect(maxShiftedTime(pts, bars, spacing, 30)).toBe(30);
    });

    it("leaves the seed unchanged for an empty bar run", () => {
        expect(maxShiftedTime([{ bar: 0, xShift: 5 }], [], spacing, 99)).toBe(99);
    });
});

describe("shiftedBarIndex", () => {
    it("adds the shift to the bar index", () => {
        expect(shiftedBarIndex(3, 5)).toBe(8);
        expect(shiftedBarIndex(3, -5)).toBe(-2);
    });

    it("treats an omitted shift as zero", () => {
        expect(shiftedBarIndex(3, undefined)).toBe(3);
    });
});
