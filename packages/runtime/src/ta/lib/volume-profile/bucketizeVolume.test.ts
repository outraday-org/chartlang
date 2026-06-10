// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/bucketize-volume.test.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import { describe, expect, it } from "vitest";

import { GOLDEN_BUCKETS, bar } from "./__fixtures__/volumeProfileFixtures.js";
import { bucketizeVolume, bucketizeVolumeDetailed } from "./bucketizeVolume.js";

describe("bucketizeVolume", () => {
    it("single bar entirely inside one bucket goes wholly into that bucket as up", () => {
        const edges = new Float64Array([100, 101, 102, 103]);
        const bars = [bar({ close: 101.5, high: 101.6, low: 101.2, open: 101.3, volume: 100 })];
        const result = bucketizeVolumeDetailed(bars, edges, "upDown");
        expect(result.rows[1].upVolume).toBeCloseTo(100, 6);
        expect(result.rows[1].downVolume).toBe(0);
        expect(result.rows[0].volume).toBe(0);
        expect(result.rows[2].volume).toBe(0);
        expect(result.pocIdx).toBe(1);
        expect(result.totalVolume).toBeCloseTo(100, 6);
    });

    it("single bar spanning two buckets distributes by intersection length", () => {
        const edges = new Float64Array([100, 101, 102]);
        const bars = [bar({ close: 101, high: 101.5, low: 100.5, open: 100.7, volume: 200 })];
        const result = bucketizeVolume(bars, edges, "upDown");
        expect(result).toEqual(GOLDEN_BUCKETS);
    });

    it("multiple bars sum correctly", () => {
        const edges = new Float64Array([100, 101]);
        const bars = [
            bar({ close: 100.5, high: 100.8, low: 100.2, open: 100.3, volume: 50 }),
            bar({ close: 100.5, high: 100.9, low: 100.1, open: 100.4, volume: 30 }),
        ];
        const result = bucketizeVolumeDetailed(bars, edges, "upDown");
        expect(result.rows[0].volume).toBeCloseTo(80, 6);
    });

    it("classifies down bars as downVolume", () => {
        const result = bucketizeVolumeDetailed(
            [bar({ close: 100.2, high: 100.8, low: 100.1, open: 100.6, volume: 100 })],
            new Float64Array([100, 101]),
            "upDown",
        );
        expect(result.rows[0].upVolume).toBe(0);
        expect(result.rows[0].downVolume).toBeCloseTo(100, 6);
    });

    it("delta mode subtracts up vs down", () => {
        const result = bucketizeVolumeDetailed(
            [
                bar({ close: 100.5, high: 100.8, low: 100.2, open: 100.3, volume: 70 }),
                bar({ close: 100.4, high: 100.7, low: 100.2, open: 100.6, volume: 30 }),
            ],
            new Float64Array([100, 101]),
            "delta",
        );
        expect(result.rows[0].upVolume).toBeCloseTo(40, 6);
        expect(result.rows[0].downVolume).toBe(0);
    });

    it("delta mode reports negative deltas in downVolume", () => {
        const result = bucketizeVolumeDetailed(
            [
                bar({ close: 100.4, high: 100.8, low: 100.2, open: 100.6, volume: 70 }),
                bar({ close: 100.5, high: 100.7, low: 100.2, open: 100.3, volume: 30 }),
            ],
            new Float64Array([100, 101]),
            "delta",
        );
        expect(result.rows[0].upVolume).toBe(0);
        expect(result.rows[0].downVolume).toBeCloseTo(40, 6);
    });

    it("total mode collapses both sides into upVolume", () => {
        const result = bucketizeVolumeDetailed(
            [
                bar({ close: 100.5, high: 100.8, low: 100.2, open: 100.3, volume: 70 }),
                bar({ close: 100.4, high: 100.7, low: 100.2, open: 100.6, volume: 30 }),
            ],
            new Float64Array([100, 101]),
            "total",
        );
        expect(result.rows[0].upVolume).toBeCloseTo(100, 6);
        expect(result.rows[0].downVolume).toBe(0);
        expect(result.rows[0].volume).toBeCloseTo(100, 6);
    });

    it("handles empty edges and non-positive or non-finite volume", () => {
        expect(bucketizeVolumeDetailed([], new Float64Array(0), "total")).toEqual({
            buckets: [],
            pocIdx: -1,
            rows: [],
            totalVolume: 0,
        });
        const result = bucketizeVolumeDetailed(
            [
                bar({ close: 100, high: 101, low: 100, open: 100, volume: Number.NaN }),
                bar({ close: 100, high: 101, low: 100, open: 100, volume: -1 }),
            ],
            new Float64Array([100, 101]),
            "total",
        );
        expect(result.totalVolume).toBe(0);
        expect(result.pocIdx).toBe(0);
    });

    it("skips zero-overlap zero-range bars", () => {
        const result = bucketizeVolumeDetailed(
            [bar({ close: 100.5, high: 100.5, low: 100.5, open: 100.5, volume: 100 })],
            new Float64Array([100, 101]),
            "total",
        );
        expect(result.totalVolume).toBe(0);
    });

    it("skips bars with non-finite low / high / open / close", () => {
        const result = bucketizeVolumeDetailed(
            [
                bar({ close: 100.5, high: Number.NaN, low: 100.2, open: 100.3, volume: 100 }),
                bar({ close: 100.5, high: 100.8, low: Number.NaN, open: 100.3, volume: 100 }),
                bar({ close: Number.NaN, high: 100.8, low: 100.2, open: 100.3, volume: 100 }),
                bar({ close: 100.5, high: 100.8, low: 100.2, open: Number.NaN, volume: 100 }),
            ],
            new Float64Array([100, 101]),
            "total",
        );
        expect(result.totalVolume).toBe(0);
    });

    it("skips inverted bars where high <= low", () => {
        const result = bucketizeVolumeDetailed(
            [bar({ close: 100.5, high: 100.2, low: 100.8, open: 100.3, volume: 100 })],
            new Float64Array([100, 101]),
            "total",
        );
        expect(result.totalVolume).toBe(0);
    });

    it("skips zero-width buckets straddled by a bar", () => {
        // Edge pair [100, 100] is a zero-width bucket fully inside the bar's
        // [99.5, 101] range — overlap evaluates to 0 and the bucket is skipped.
        const result = bucketizeVolumeDetailed(
            [bar({ close: 100.5, high: 101, low: 99.5, open: 100, volume: 100 })],
            new Float64Array([100, 100, 101]),
            "total",
        );
        expect(result.rows[0].volume).toBe(0);
        expect(result.totalVolume).toBeGreaterThan(0);
    });
});
