// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/volume-profile-shared.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import { describe, expect, it } from "vitest";

import { syntheticProfileBars } from "./__fixtures__/volumeProfileFixtures.js";
import { computeProfile, sliceBarsByTime } from "./volumeProfileShared.js";

describe("computeProfile", () => {
    it("returns an empty profile for empty lanes", () => {
        const profile = computeProfile({
            config: { rowSize: 10, valueAreaPct: 70 },
            laneBars: [],
            windowFromIdx: 0,
            windowToIdx: 0,
        });
        expect(profile.buckets).toEqual([]);
        expect(Number.isNaN(profile.poc)).toBe(true);
    });

    it("computes buckets, value-area mask, and developing series", () => {
        const bars = syntheticProfileBars(50);
        const profile = computeProfile({
            computeDeveloping: true,
            config: { rowSize: 10, valueAreaPct: 70 },
            laneBars: bars,
            windowFromIdx: 0,
            windowToIdx: bars.length - 1,
        });
        expect(profile.buckets.length).toBe(10);
        expect(profile.valueAreaMask.length).toBe(10);
        expect(Number.isFinite(profile.poc)).toBe(true);
        expect(profile.developing?.developingPoc.length).toBe(bars.length);
    });

    it("uses finer bars sliced to the lane time window", () => {
        const laneBars = syntheticProfileBars(5);
        const finerBars = syntheticProfileBars(20);
        const profile = computeProfile({
            config: { rowSize: 5, valueAreaPct: 70 },
            finerBars,
            laneBars,
            windowFromIdx: 1,
            windowToIdx: 3,
        });
        expect(profile.rows.length).toBe(5);
    });

    it("returns empty profile for degenerate price ranges and heavy windows", () => {
        const flatBars = syntheticProfileBars(3).map((bar) => ({ ...bar, high: 1, low: 1 }));
        expect(
            computeProfile({
                config: { rowSize: 10, valueAreaPct: 70 },
                laneBars: flatBars,
                windowFromIdx: 0,
                windowToIdx: 2,
            }).buckets,
        ).toEqual([]);
        expect(
            computeProfile({
                config: { rowSize: 2_001, valueAreaPct: 70 },
                laneBars: syntheticProfileBars(10),
                windowFromIdx: 0,
                windowToIdx: 9,
            }).costStatus,
        ).toMatchObject({ heavy: true, reason: "too-many-buckets" });
    });

    it("returns empty profile after bucketization when all volume is zero", () => {
        const bars = syntheticProfileBars(35).map((item) => ({ ...item, volume: 0 }));
        const profile = computeProfile({
            config: { rowSize: 10, valueAreaPct: 70 },
            laneBars: bars,
            windowFromIdx: 0,
            windowToIdx: bars.length - 1,
        });
        expect(profile.buckets).toEqual([]);
    });

    it("sliceBarsByTime covers empty, matched, and unmatched ranges", () => {
        const bars = syntheticProfileBars(5);
        expect(sliceBarsByTime([], 0, 1)).toEqual([]);
        expect(sliceBarsByTime(bars, bars[1].time, bars[3].time)).toHaveLength(3);
        expect(sliceBarsByTime(bars, 999_999, 1_000_000)).toEqual([]);
    });
});
