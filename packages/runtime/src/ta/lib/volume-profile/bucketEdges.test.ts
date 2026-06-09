// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/bucket-edges.test.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import { describe, expect, it } from "vitest";

import { buildBucketEdges } from "./bucketEdges";

describe("buildBucketEdges", () => {
    it("ticksPerRow uses rowSize * tickSize as bucket width", () => {
        const edges = buildBucketEdges(100, 105, "ticksPerRow", 10, 0.01);
        expect(edges.length).toBe(51);
        expect(edges[0]).toBeCloseTo(100, 6);
        expect(edges[50]).toBeCloseTo(105, 6);
        expect(edges[1] - edges[0]).toBeCloseTo(0.1, 6);
    });

    it("numberOfRows divides the range evenly", () => {
        const edges = buildBucketEdges(0, 10, "numberOfRows", 5, 0.01);
        expect(edges.length).toBe(6);
        expect(edges[0]).toBe(0);
        expect(edges[5]).toBe(10);
        expect(edges[1]).toBe(2);
    });

    it("zero-range degenerate returns a single zero-width bucket", () => {
        const edges = buildBucketEdges(50, 50, "ticksPerRow", 10, 0.01);
        expect(Array.from(edges)).toEqual([50, 50]);
    });

    it("invalid inputs collapse to a degenerate bucket", () => {
        expect(Array.from(buildBucketEdges(Number.NaN, 200, "ticksPerRow", 10, 0.01))).toEqual([
            Number.NaN,
            Number.NaN,
        ]);
        expect(Array.from(buildBucketEdges(100, 200, "ticksPerRow", 0, 0.01))).toEqual([100, 100]);
        expect(Array.from(buildBucketEdges(100, 200, "ticksPerRow", 10, 0))).toEqual([100, 100]);
    });
});
