// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import {
    medianBarSpacing,
    priceToY,
    projectShiftedX,
    shiftedBarTime,
    timeToX,
    yToPrice,
    type Viewport,
} from "./coords.js";

const viewport: Viewport = {
    xMin: 0,
    xMax: 10,
    yMin: 100,
    yMax: 110,
    pxWidth: 200,
    pxHeight: 100,
};

describe("priceToY / yToPrice", () => {
    it("maps yMax to y=0 and yMin to y=pxHeight", () => {
        expect(priceToY(110, viewport)).toBe(0);
        expect(priceToY(100, viewport)).toBe(100);
    });

    it("maps midpoint price to midpoint y", () => {
        expect(priceToY(105, viewport)).toBe(50);
    });

    it("round-trips through yToPrice for a deterministic random sample", () => {
        // Mulberry32 seeded for determinism — no Math.random.
        let s = 0x9e3779b9;
        function next(): number {
            s |= 0;
            s = (s + 0x6d2b79f5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
        }
        for (let i = 0; i < 50; i++) {
            const p = viewport.yMin + next() * (viewport.yMax - viewport.yMin);
            const round = yToPrice(priceToY(p, viewport), viewport);
            expect(round).toBeCloseTo(p, 9);
        }
    });
});

describe("timeToX", () => {
    it("maps xMin to 0 and xMax to pxWidth", () => {
        expect(timeToX(0, viewport)).toBe(0);
        expect(timeToX(10, viewport)).toBe(200);
    });

    it("maps midpoint time to midpoint x", () => {
        expect(timeToX(5, viewport)).toBe(100);
    });

    it("pins single-bar viewport to canvas centre", () => {
        const single: Viewport = { ...viewport, xMin: 7, xMax: 7 };
        expect(timeToX(7, single)).toBe(100);
        expect(timeToX(99, single)).toBe(100);
    });
});

describe("medianBarSpacing", () => {
    it("returns 0 for an empty or single-bar run", () => {
        expect(medianBarSpacing([])).toBe(0);
        expect(medianBarSpacing([{ time: 5 }])).toBe(0);
    });

    it("returns the spacing of an evenly spaced run (odd delta count)", () => {
        expect(medianBarSpacing([{ time: 0 }, { time: 10 }, { time: 20 }, { time: 30 }])).toBe(10);
    });

    it("returns the median of an uneven run (even delta count averages the middle two)", () => {
        // deltas [10, 30] → median (10 + 30) / 2 = 20
        expect(medianBarSpacing([{ time: 0 }, { time: 10 }, { time: 40 }])).toBe(20);
        // deltas [5, 10, 20] sorted → middle element 10
        expect(medianBarSpacing([{ time: 0 }, { time: 20 }, { time: 25 }, { time: 35 }])).toBe(10);
    });
});

describe("shiftedBarTime", () => {
    const bars = [{ time: 0 }, { time: 10 }, { time: 20 }, { time: 30 }];
    const spacing = 10;

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
        // j = 3 + 2 = 5 → 30 + (5 - 3) * 10 = 50
        expect(shiftedBarTime({ bars, bar: 3, xShift: 2, spacing })).toBe(50);
    });

    it("extrapolates before the first bar for a far-past shift", () => {
        // j = 0 - 2 = -2 → 0 + (-2) * 10 = -20
        expect(shiftedBarTime({ bars, bar: 0, xShift: -2, spacing })).toBe(-20);
    });

    it("zero spacing collapses an out-of-range shift to the anchor bar's time", () => {
        expect(shiftedBarTime({ bars, bar: 3, xShift: 5, spacing: 0 })).toBe(30);
        expect(shiftedBarTime({ bars, bar: 0, xShift: -5, spacing: 0 })).toBe(0);
    });
});

describe("projectShiftedX", () => {
    const bars = [{ time: 0 }, { time: 10 }, { time: 20 }];

    it("round-trips to timeToX(point.time) for an unshifted point", () => {
        const x = projectShiftedX({ bars, bar: 1, xShift: undefined, spacing: 10 }, viewport);
        expect(x).toBe(timeToX(10, viewport));
    });

    it("projects a shifted point through timeToX of the displaced time", () => {
        const x = projectShiftedX({ bars, bar: 0, xShift: 1, spacing: 10 }, viewport);
        expect(x).toBe(timeToX(10, viewport));
    });
});
