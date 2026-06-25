// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { LINE_STRIP_STRIDE_FLOATS, packLineStrip, sampleMonotoneRuns } from "./line-strip-pack.js";

// Build a `[x0,y0,x1,y1,…]` world buffer from xy pairs.
function pts(pairs: ReadonlyArray<readonly [number, number]>): {
    points: Float32Array;
    pointCount: number;
} {
    const points = new Float32Array(pairs.length * 2);
    pairs.forEach(([x, y], i) => {
        points[i * 2] = x;
        points[i * 2 + 1] = y;
    });
    return { points, pointCount: pairs.length };
}

describe("packLineStrip — stride + segment count", () => {
    it("stride is 12 floats", () => {
        expect(LINE_STRIP_STRIDE_FLOATS).toBe(12);
    });

    it("a 2-point line yields one segment", () => {
        const { points, pointCount } = pts([
            [0, 0],
            [1, 1],
        ]);
        const r = packLineStrip({ points, pointCount, pxToWorldX: 1, pxToWorldY: 1 });
        expect(r.segmentCount).toBe(1);
        expect(r.instanceData.length).toBe(LINE_STRIP_STRIDE_FLOATS);
    });

    it("an N-point polyline yields N-1 segments", () => {
        const { points, pointCount } = pts([
            [0, 0],
            [1, 1],
            [2, 2],
            [3, 1],
        ]);
        const r = packLineStrip({ points, pointCount, pxToWorldX: 1, pxToWorldY: 1 });
        expect(r.segmentCount).toBe(3);
        expect(r.instanceData.length).toBe(3 * LINE_STRIP_STRIDE_FLOATS);
    });

    it("clamps segmentCount to >= 0 for a 0/1-point input", () => {
        expect(
            packLineStrip({
                points: new Float32Array(0),
                pointCount: 0,
                pxToWorldX: 1,
                pxToWorldY: 1,
            }).segmentCount,
        ).toBe(0);
        const single = pts([[5, 5]]);
        expect(packLineStrip({ ...single, pxToWorldX: 1, pxToWorldY: 1 }).segmentCount).toBe(0);
    });
});

describe("packLineStrip — neighbour layout", () => {
    it("first segment reuses current as its own prev; last reuses next as further", () => {
        const { points, pointCount } = pts([
            [0, 0],
            [10, 10],
            [20, 0],
        ]);
        const r = packLineStrip({ points, pointCount, pxToWorldX: 1, pxToWorldY: 1 });
        // Segment 0: prev = current (no real prev) → [0,0]; current [0,0]; next [10,10]; further [20,0].
        expect([r.instanceData[0], r.instanceData[1]]).toEqual([0, 0]); // prev
        expect([r.instanceData[2], r.instanceData[3]]).toEqual([0, 0]); // current
        expect([r.instanceData[4], r.instanceData[5]]).toEqual([10, 10]); // next
        expect([r.instanceData[6], r.instanceData[7]]).toEqual([20, 0]); // further
        // Segment 1 (last): prev [0,0]; current [10,10]; next [20,0]; further = next [20,0].
        const base = LINE_STRIP_STRIDE_FLOATS;
        expect([r.instanceData[base + 6], r.instanceData[base + 7]]).toEqual([20, 0]);
    });
});

describe("packLineStrip — arclength", () => {
    it("cumulativePx starts at 0 and grows by pixel distance", () => {
        const { points, pointCount } = pts([
            [0, 0],
            [3, 4], // distance 5 in px units (pxToWorld = 1)
            [3, 9], // +5
        ]);
        const r = packLineStrip({ points, pointCount, pxToWorldX: 1, pxToWorldY: 1 });
        expect(r.cumulativePx[0]).toBe(0);
        expect(r.cumulativePx[1]).toBeCloseTo(5, 9);
        expect(r.cumulativePx[2]).toBeCloseTo(10, 9);
        // Arclength start/end land in the instance buffer columns 8 / 9.
        expect(r.instanceData[8]).toBe(0);
        expect(r.instanceData[9]).toBeCloseTo(5, 9);
    });

    it("scales distance by pxToWorld (world deltas → pixel arclength)", () => {
        const { points, pointCount } = pts([
            [0, 0],
            [10, 0], // 10 world units; pxToWorldX = 2 ⇒ 5 px
        ]);
        const r = packLineStrip({ points, pointCount, pxToWorldX: 2, pxToWorldY: 2 });
        expect(r.cumulativePx[1]).toBeCloseTo(5, 9);
    });

    it("carries the last finite arclength across a NaN gap (dashes stay dashed)", () => {
        const { points, pointCount } = pts([
            [0, 0],
            [10, 10],
            [20, Number.NaN], // gap
            [30, 30],
        ]);
        const r = packLineStrip({ points, pointCount, pxToWorldX: 1, pxToWorldY: 1 });
        // The arclength at the NaN point equals the previous finite value
        // (not NaN), so it does not poison every downstream segment.
        expect(Number.isFinite(r.cumulativePx[2])).toBe(true);
        expect(r.cumulativePx[2]).toBe(r.cumulativePx[1]);
        // The arclength after the gap stays finite too.
        expect(Number.isFinite(r.cumulativePx[3])).toBe(true);
    });

    it("preserves the raw NaN endpoint in the instance buffer (vertex shader collapses it)", () => {
        const { points, pointCount } = pts([
            [0, 0],
            [10, Number.NaN],
            [20, 20],
        ]);
        const r = packLineStrip({ points, pointCount, pxToWorldX: 1, pxToWorldY: 1 });
        // Segment 0's `next` (column 4,5) carries the raw NaN y.
        expect(Number.isNaN(r.instanceData[5])).toBe(true);
    });
});

describe("sampleMonotoneRuns", () => {
    it("passes a <2-point input straight through", () => {
        const { points } = pts([[0, 0]]);
        const out = sampleMonotoneRuns(points, 1);
        expect(Array.from(out)).toEqual([0, 0]);
    });

    it("passes a 2-point run through unchanged (too short to smooth)", () => {
        const { points } = pts([
            [0, 0],
            [1, 1],
        ]);
        const out = sampleMonotoneRuns(points, 2);
        expect(Array.from(out)).toEqual([0, 0, 1, 1]);
    });

    it("densifies a 3+-point run with intermediate samples", () => {
        const { points, pointCount } = pts([
            [0, 0],
            [1, 1],
            [2, 0],
        ]);
        const out = sampleMonotoneRuns(points, pointCount);
        // More points than the input (intermediate samples inserted).
        expect(out.length).toBeGreaterThan(pointCount * 2);
        // Endpoints preserved exactly (curve interpolates).
        expect([out[0], out[1]]).toEqual([0, 0]);
        expect([out[out.length - 2], out[out.length - 1]]).toEqual([2, 0]);
    });

    it("samples each finite run independently and preserves the NaN gap", () => {
        const { points, pointCount } = pts([
            [0, 0],
            [1, 1],
            [2, 0],
            [3, Number.NaN], // gap between two runs
            [4, 0],
            [5, 1],
            [6, 0],
        ]);
        const out = sampleMonotoneRuns(points, pointCount);
        // The NaN y is preserved somewhere in the output (the gap survives).
        let hasNaN = false;
        for (let i = 1; i < out.length; i += 2) {
            if (Number.isNaN(out[i])) hasNaN = true;
        }
        expect(hasNaN).toBe(true);
        // Both runs got densified (more than the 6 finite + 1 gap points).
        expect(out.length).toBeGreaterThan(7 * 2);
    });

    it("keeps a short finite run between gaps verbatim", () => {
        const { points, pointCount } = pts([
            [0, 0],
            [1, Number.NaN],
            [2, 5],
            [3, 6], // a 2-point run — too short to smooth
        ]);
        const out = sampleMonotoneRuns(points, pointCount);
        // The trailing 2-point run survives unchanged at the tail.
        expect([out[out.length - 4], out[out.length - 3]]).toEqual([2, 5]);
        expect([out[out.length - 2], out[out.length - 1]]).toEqual([3, 6]);
    });
});
