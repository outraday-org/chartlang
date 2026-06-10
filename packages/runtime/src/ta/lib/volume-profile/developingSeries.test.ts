// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/developing-series.test.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import { describe, expect, it } from "vitest";

import { syntheticProfileBars } from "./__fixtures__/volumeProfileFixtures.js";
import { computeDevelopingSeries, derivePriceRange } from "./developingSeries.js";

const CONFIG = {
    rowSize: 10,
    rowsLayout: "numberOfRows",
    valueAreaPct: 70,
    volumeSplit: "upDown",
} as const;

describe("computeDevelopingSeries", () => {
    it("NaN-fills the warmup region", () => {
        const bars = syntheticProfileBars(50);
        const result = computeDevelopingSeries({
            config: CONFIG,
            finerBars: [],
            laneBars: bars,
            windowFromIdx: 0,
            windowToIdx: bars.length - 1,
        });
        for (let i = 0; i < 30; i += 1) {
            expect(Number.isNaN(result.developingPoc[i])).toBe(true);
            expect(Number.isNaN(result.developingVahHigh[i])).toBe(true);
            expect(Number.isNaN(result.developingVahLow[i])).toBe(true);
        }
    });

    it("emits finite values past the warmup boundary", () => {
        const bars = syntheticProfileBars(50);
        const result = computeDevelopingSeries({
            config: CONFIG,
            finerBars: [],
            laneBars: bars,
            windowFromIdx: 0,
            windowToIdx: bars.length - 1,
        });
        expect(Number.isFinite(result.developingPoc[35])).toBe(true);
        expect(Number.isFinite(result.developingVahHigh[35])).toBe(true);
        expect(Number.isFinite(result.developingVahLow[35])).toBe(true);
        expect(result.developingVahHigh[35]).toBeGreaterThanOrEqual(result.developingVahLow[35]);
    });

    it("returns empty arrays when bars are empty", () => {
        const result = computeDevelopingSeries({
            config: CONFIG,
            finerBars: [],
            laneBars: [],
            windowFromIdx: 0,
            windowToIdx: 0,
        });
        expect(result.developingPoc.length).toBe(0);
        expect(result.developingVahHigh.length).toBe(0);
        expect(result.developingVahLow.length).toBe(0);
    });

    it("uses finer bars when provided and clamps window indexes", () => {
        const laneBars = syntheticProfileBars(40);
        const finerBars = syntheticProfileBars(80);
        const result = computeDevelopingSeries({
            config: CONFIG,
            finerBars,
            laneBars,
            windowFromIdx: -10,
            windowToIdx: 100,
        });
        expect(result.developingPoc.length).toBe(laneBars.length);
    });

    it("keeps NaN when accumulated bars cannot produce a profile", () => {
        const laneBars = syntheticProfileBars(40).map((item) => ({ ...item, high: 1, low: 1 }));
        const result = computeDevelopingSeries({
            config: CONFIG,
            finerBars: [],
            laneBars,
            windowFromIdx: 0,
            windowToIdx: 39,
        });
        expect(Number.isNaN(result.developingPoc[35])).toBe(true);
    });

    it("binary-searches into finer bars that start before the lane window", () => {
        const laneBars = syntheticProfileBars(40);
        const finerBars = syntheticProfileBars(80);
        const result = computeDevelopingSeries({
            config: CONFIG,
            finerBars,
            laneBars,
            windowFromIdx: 10,
            windowToIdx: 39,
        });
        expect(result.developingPoc.length).toBe(40);
    });

    it("derivePriceRange handles empty and populated slices", () => {
        expect(derivePriceRange([])).toEqual({ priceMax: 0, priceMin: 0 });
        expect(
            derivePriceRange([
                { high: 4, low: 2 },
                { high: 5, low: 1 },
            ]),
        ).toEqual({ priceMax: 5, priceMin: 1 });
    });

    it("derivePriceRange skips bars with non-finite low / high", () => {
        const bars = [
            { high: Number.NaN, low: 2 },
            { high: 4, low: Number.NaN },
            { high: 5, low: 1 },
        ];
        expect(derivePriceRange(bars)).toEqual({ priceMax: 5, priceMin: 1 });
    });

    it("derivePriceRange returns zeros when every bar is non-finite", () => {
        const bars = [
            { high: Number.NaN, low: Number.NaN },
            { high: Number.POSITIVE_INFINITY, low: 1 },
        ];
        expect(derivePriceRange(bars)).toEqual({ priceMax: 0, priceMin: 0 });
    });
});
