// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import {
    computeAxisTicks,
    formatPrice,
    formatTime,
    niceStep,
    niceTicks,
    packGridLines,
    priceTicks,
    timeTicks,
} from "./axes.js";

describe("niceStep", () => {
    it("snaps a raw step up the {1,2,5}×10^k ladder", () => {
        expect(niceStep(0.0023)).toBeCloseTo(0.005, 10);
        expect(niceStep(170)).toBe(200);
        expect(niceStep(1)).toBe(1);
        expect(niceStep(3)).toBe(5);
        expect(niceStep(7)).toBe(10);
    });

    it("falls back to 1 for a non-positive / non-finite step", () => {
        expect(niceStep(0)).toBe(1);
        expect(niceStep(-5)).toBe(1);
        expect(niceStep(Number.NaN)).toBe(1);
    });
});

describe("niceTicks", () => {
    it("returns evenly spaced nice ticks inside the range", () => {
        const ticks = niceTicks(0, 97, 5);
        expect(ticks).toEqual([0, 20, 40, 60, 80]);
    });

    it("is monotonic increasing and stays within [min, max]", () => {
        const ticks = niceTicks(13.4, 88.1, 5);
        for (let i = 1; i < ticks.length; i++) {
            expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
        }
        expect(ticks[0]).toBeGreaterThanOrEqual(13.4);
        expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(88.1);
    });

    it("re-snaps to the step grid so accumulated FP error never drifts a tick", () => {
        // step = niceStep(1/5) = 0.2; each tick must land on a step multiple
        // (within FP tolerance) rather than drifting as the accumulator sums.
        const ticks = niceTicks(0, 1, 5);
        const step = 0.2;
        for (const t of ticks) {
            const k = Math.round(t / step);
            expect(t).toBeCloseTo(k * step, 10);
        }
    });

    it("returns a single tick for a degenerate span", () => {
        expect(niceTicks(5, 5, 5)).toEqual([5]);
        expect(niceTicks(10, 2, 5)).toEqual([10]);
        expect(niceTicks(Number.NaN, 1, 5)).toEqual([Number.NaN]);
    });
});

describe("priceTicks", () => {
    it("delegates to niceTicks", () => {
        expect(priceTicks(100, 110, 5)).toEqual(niceTicks(100, 110, 5));
    });
});

describe("timeTicks", () => {
    it("snaps to the time-step ladder and stays in range", () => {
        const hour = 60 * 60 * 1000;
        const ticks = timeTicks(0, 3 * hour, 3);
        // raw step = 1h, a ladder rung — ticks land on the hour.
        for (const t of ticks) {
            expect(t % hour).toBe(0);
            expect(t).toBeGreaterThanOrEqual(0);
            expect(t).toBeLessThanOrEqual(3 * hour);
        }
        expect(ticks.length).toBeGreaterThan(0);
    });

    it("returns a single tick for a degenerate span", () => {
        expect(timeTicks(100, 100, 5)).toEqual([100]);
        expect(timeTicks(100, 50, 5)).toEqual([100]);
    });

    it("falls back to niceStep for a span beyond the yearly rung", () => {
        const year = 365 * 24 * 60 * 60 * 1000;
        const ticks = timeTicks(0, 40 * year, 5);
        expect(ticks.length).toBeGreaterThan(0);
        for (let i = 1; i < ticks.length; i++) {
            expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
        }
    });
});

describe("formatPrice", () => {
    it("scales decimal places to the span", () => {
        expect(formatPrice(72.318, 4)).toBe("72.32");
        expect(formatPrice(72.351, 6)).toBe("72.4");
        expect(formatPrice(72.351, 60)).toBe("72");
    });

    it("returns empty for a non-finite price", () => {
        expect(formatPrice(Number.NaN, 4)).toBe("");
    });
});

describe("formatTime", () => {
    const day = 24 * 60 * 60 * 1000;

    it("shows HH:MM for an intraday span", () => {
        // 2021-01-01T13:45:00Z
        const t = Date.UTC(2021, 0, 1, 13, 45, 0);
        expect(formatTime(t, 60 * 60 * 1000)).toBe("13:45");
    });

    it("shows Mon DD for a multi-day span", () => {
        const t = Date.UTC(2021, 2, 9);
        expect(formatTime(t, 30 * day)).toBe("Mar 09");
    });

    it("shows Mon YYYY for a multi-year span", () => {
        const t = Date.UTC(2021, 5, 15);
        expect(formatTime(t, 5 * 365 * day)).toBe("Jun 2021");
    });

    it("returns empty for a non-finite time", () => {
        expect(formatTime(Number.NaN, day)).toBe("");
    });
});

describe("packGridLines", () => {
    it("packs a horizontal line per price tick and a vertical per time tick", () => {
        const g = packGridLines(0, 100, 0, 10, {
            priceTicks: [5],
            timeTicks: [50],
        });
        // 2 lines (4 endpoints) + 1 NaN gap point = 5 points.
        expect(g.pointCount).toBe(5);
        expect(g.points.length).toBe(10);
        // First line is horizontal at price 5 across [0, 100].
        expect(Array.from(g.points.subarray(0, 4))).toEqual([0, 5, 100, 5]);
        // A NaN gap separates the price line from the time line.
        expect(Number.isNaN(g.points[4])).toBe(true);
        // Then the vertical time line at x=50 across [0, 10].
        expect(Array.from(g.points.subarray(6, 10))).toEqual([50, 0, 50, 10]);
    });

    it("yields an empty buffer for no ticks", () => {
        const g = packGridLines(0, 1, 0, 1, { priceTicks: [], timeTicks: [] });
        expect(g.pointCount).toBe(0);
        expect(g.points.length).toBe(0);
    });
});

describe("computeAxisTicks", () => {
    it("returns both axes' ticks for a window", () => {
        const ticks = computeAxisTicks(0, 100, 10, 110, 5);
        expect(ticks.priceTicks).toEqual(priceTicks(10, 110, 5));
        expect(ticks.timeTicks).toEqual(timeTicks(0, 100, 5));
    });
});
