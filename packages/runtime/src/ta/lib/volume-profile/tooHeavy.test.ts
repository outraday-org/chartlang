// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/too-heavy.test.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import { describe, expect, it } from "vitest";

import { VOLUME_PROFILE_HEAVY_THRESHOLD, assessVolumeProfileCost } from "./tooHeavy";

describe("assessVolumeProfileCost", () => {
    it("below the threshold returns heavy false", () => {
        expect(assessVolumeProfileCost({ finerCandleCount: 0 })).toEqual({
            heavy: false,
            reason: null,
            recommendedRowSize: null,
        });
        expect(
            assessVolumeProfileCost({ finerCandleCount: VOLUME_PROFILE_HEAVY_THRESHOLD }),
        ).toEqual({
            heavy: false,
            reason: null,
            recommendedRowSize: null,
        });
    });

    it("above the threshold returns heavy true", () => {
        expect(
            assessVolumeProfileCost({ finerCandleCount: VOLUME_PROFILE_HEAVY_THRESHOLD + 1 }),
        ).toEqual({
            heavy: true,
            reason: "too-many-finer-bars",
            recommendedRowSize: null,
        });
    });

    it("guards too many rows and recommends a numberOfRows fallback", () => {
        expect(
            assessVolumeProfileCost({
                finerCandleCount: 1,
                maxBuckets: 10,
                priceMax: 100,
                priceMin: 0,
                rowSize: 20,
                rowsLayout: "numberOfRows",
            }),
        ).toEqual({ heavy: true, reason: "too-many-buckets", recommendedRowSize: 10 });
    });

    it("guards too many ticksPerRow buckets and recommends a coarser rowSize", () => {
        expect(
            assessVolumeProfileCost({
                finerCandleCount: 1,
                maxBuckets: 10,
                priceMax: 100,
                priceMin: 0,
                rowSize: 1,
                rowsLayout: "ticksPerRow",
                tickSize: 1,
            }),
        ).toEqual({ heavy: true, reason: "too-many-buckets", recommendedRowSize: 10 });
    });

    it("ignores invalid range inputs", () => {
        expect(
            assessVolumeProfileCost({ finerCandleCount: 1, priceMax: 0, priceMin: 10, rowSize: 1 }),
        ).toEqual({
            heavy: false,
            reason: null,
            recommendedRowSize: null,
        });
        expect(
            assessVolumeProfileCost({
                finerCandleCount: 1,
                maxBuckets: 10,
                priceMax: 100,
                priceMin: 0,
                rowSize: 1,
                rowsLayout: "ticksPerRow",
                tickSize: 0,
            }),
        ).toEqual({ heavy: false, reason: null, recommendedRowSize: null });
    });

    it("returns null fallback when heavy input lacks enough fallback data", () => {
        expect(
            assessVolumeProfileCost({
                finerCandleCount: 1,
                maxBuckets: 0,
                priceMax: 100,
                priceMin: 0,
                rowsLayout: "numberOfRows",
            }),
        ).toEqual({ heavy: false, reason: null, recommendedRowSize: null });
        expect(
            assessVolumeProfileCost({
                finerCandleCount: 1,
                maxBuckets: 0,
                priceMax: 100,
                priceMin: 0,
                rowSize: 1,
                rowsLayout: "ticksPerRow",
                tickSize: 0,
            }),
        ).toEqual({ heavy: false, reason: null, recommendedRowSize: null });
    });

    it("threshold constant matches the documented value", () => {
        expect(VOLUME_PROFILE_HEAVY_THRESHOLD).toBe(50_000);
    });
});
