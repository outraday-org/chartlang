// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { computeAtrSeries, computeTrSeries, trueRangeAt } from "./trSeries.js";

function bar(open: number, high: number, low: number, close: number, i = 0): Bar {
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open,
        high,
        low,
        close,
        volume: 0,
        symbol: "T",
        interval: "1m",
    };
}

describe("trueRangeAt", () => {
    it("reduces to high − low for bar 0", () => {
        const bars = [bar(10, 14, 9, 12)];
        expect(trueRangeAt(bars, 0)).toBe(5);
    });

    it("picks the largest of the three candidates", () => {
        const bars = [bar(10, 14, 9, 12, 0), bar(12, 16, 11, 15, 1)];
        // |16 − 12| = 4 ; |11 − 12| = 1 ; high − low = 5 ; max = 5
        expect(trueRangeAt(bars, 1)).toBe(5);
    });
});

describe("computeTrSeries", () => {
    it("returns a buffer the size of the bars array", () => {
        const bars = [bar(10, 14, 9, 12, 0), bar(12, 16, 11, 15, 1)];
        const tr = computeTrSeries(bars);
        expect(tr.length).toBe(2);
        expect(tr[0]).toBe(5);
    });

    it("returns an empty buffer for empty input", () => {
        expect(computeTrSeries([]).length).toBe(0);
    });
});

describe("computeAtrSeries", () => {
    it("returns all-NaN for length ≤ 0", () => {
        const bars = [bar(10, 14, 9, 12), bar(12, 16, 11, 15, 1)];
        const { atr } = computeAtrSeries(bars, 0);
        for (const v of atr) expect(Number.isNaN(v)).toBe(true);
    });

    it("returns all-NaN if length > bars.length", () => {
        const bars = [bar(10, 14, 9, 12)];
        const { atr } = computeAtrSeries(bars, 5);
        for (const v of atr) expect(Number.isNaN(v)).toBe(true);
    });

    it("seeds at length-1 with the simple mean of the first length TR values", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 5; i += 1) bars.push(bar(10 + i, 12 + i, 8 + i, 11 + i, i));
        const { atr, tr } = computeAtrSeries(bars, 3);
        const seed = (tr[0] + tr[1] + tr[2]) / 3;
        expect(atr[2]).toBeCloseTo(seed, 12);
        expect(atr[3]).toBeCloseTo((atr[2] * 2 + tr[3]) / 3, 12);
    });
});
