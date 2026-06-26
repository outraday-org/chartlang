// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ArrayStateSlot } from "./arrayStateSlot.js";
import {
    reduceAvg,
    reduceIncludes,
    reduceIndexOf,
    reduceMax,
    reduceMedian,
    reduceMin,
    reducePercentile,
    reduceRange,
    reduceSort,
    reduceStdev,
    reduceSum,
    reduceVariance,
} from "./arrayReductions.js";

/** Build a `Float64RingBuffer` (capacity = values.length, or `capacity`). */
function ringOf(values: ReadonlyArray<number>, capacity = values.length): Float64RingBuffer {
    const ring = new Float64RingBuffer(Math.max(capacity, 1));
    for (const v of values) ring.append(v);
    return ring;
}

describe("array reductions — sum / avg", () => {
    it("sums and averages the non-NaN elements", () => {
        const ring = ringOf([2, 4, 6]);
        expect(reduceSum(ring)).toBe(12);
        expect(reduceAvg(ring)).toBe(4);
    });

    it("skips NaN elements", () => {
        const ring = ringOf([2, Number.NaN, 4]);
        expect(reduceSum(ring)).toBe(6);
        expect(reduceAvg(ring)).toBe(3);
    });

    it("returns NaN for an empty window", () => {
        const ring = new Float64RingBuffer(4);
        expect(reduceSum(ring)).toBeNaN();
        expect(reduceAvg(ring)).toBeNaN();
    });

    it("returns NaN for an all-NaN window", () => {
        const ring = ringOf([Number.NaN, Number.NaN]);
        expect(reduceSum(ring)).toBeNaN();
        expect(reduceAvg(ring)).toBeNaN();
    });
});

describe("array reductions — min / max / range", () => {
    it("computes min, max and range over non-NaN elements", () => {
        const ring = ringOf([5, 2, 9, 7]);
        expect(reduceMin(ring)).toBe(2);
        expect(reduceMax(ring)).toBe(9);
        expect(reduceRange(ring)).toBe(7);
    });

    it("skips NaN elements", () => {
        const ring = ringOf([Number.NaN, 3, Number.NaN, 8]);
        expect(reduceMin(ring)).toBe(3);
        expect(reduceMax(ring)).toBe(8);
        expect(reduceRange(ring)).toBe(5);
    });

    it("returns NaN for empty / all-NaN windows", () => {
        const empty = new Float64RingBuffer(2);
        expect(reduceMin(empty)).toBeNaN();
        expect(reduceMax(empty)).toBeNaN();
        expect(reduceRange(empty)).toBeNaN();
        const allNaN = ringOf([Number.NaN]);
        expect(reduceMin(allNaN)).toBeNaN();
        expect(reduceMax(allNaN)).toBeNaN();
        expect(reduceRange(allNaN)).toBeNaN();
    });

    it("single element → range 0", () => {
        const ring = ringOf([42]);
        expect(reduceRange(ring)).toBe(0);
    });
});

describe("array reductions — variance / stdev", () => {
    it("population variance & stdev by default (denominator = count)", () => {
        const ring = ringOf([2, 4, 4, 4, 5, 5, 7, 9]);
        // population variance of this classic sample = 4, stdev = 2.
        expect(reduceVariance(ring)).toBeCloseTo(4, 12);
        expect(reduceStdev(ring)).toBeCloseTo(2, 12);
    });

    it("sample variance & stdev when biased === false (denominator = count − 1)", () => {
        const ring = ringOf([2, 4, 4, 4, 5, 5, 7, 9]);
        // sample variance = 32 / 7.
        expect(reduceVariance(ring, false)).toBeCloseTo(32 / 7, 12);
        expect(reduceStdev(ring, false)).toBeCloseTo(Math.sqrt(32 / 7), 12);
    });

    it("skips NaN elements", () => {
        const clean = ringOf([1, 2, 3]);
        const dirty = ringOf([1, Number.NaN, 2, 3, Number.NaN]);
        expect(reduceVariance(dirty)).toBeCloseTo(reduceVariance(clean), 12);
    });

    it("single element → population variance 0, sample variance NaN", () => {
        const ring = ringOf([5]);
        expect(reduceVariance(ring)).toBe(0);
        expect(reduceStdev(ring)).toBe(0);
        expect(reduceVariance(ring, false)).toBeNaN();
        expect(reduceStdev(ring, false)).toBeNaN();
    });

    it("empty / all-NaN window → NaN for both population and sample", () => {
        const empty = new Float64RingBuffer(2);
        expect(reduceVariance(empty)).toBeNaN();
        expect(reduceVariance(empty, false)).toBeNaN();
        expect(reduceStdev(empty)).toBeNaN();
    });
});

describe("array reductions — median / percentile", () => {
    it("median of an odd window is the middle value", () => {
        expect(reduceMedian(ringOf([3, 1, 2]))).toBe(2);
    });

    it("median of an even window is the mean of the two middle values", () => {
        expect(reduceMedian(ringOf([1, 2, 3, 4]))).toBe(2.5);
    });

    it("median skips NaN and is NaN on an empty / all-NaN window", () => {
        expect(reduceMedian(ringOf([1, Number.NaN, 3]))).toBe(2);
        expect(reduceMedian(new Float64RingBuffer(2))).toBeNaN();
        expect(reduceMedian(ringOf([Number.NaN]))).toBeNaN();
    });

    it("percentile(0) is the min, percentile(100) is the max", () => {
        const ring = ringOf([10, 20, 30, 40]);
        expect(reducePercentile(ring, 0)).toBe(10);
        expect(reducePercentile(ring, 100)).toBe(40);
    });

    it("percentile(50) equals median", () => {
        const ring = ringOf([4, 1, 3, 2, 5]);
        expect(reducePercentile(ring, 50)).toBe(reduceMedian(ring));
    });

    it("percentile interpolates linearly between ranks", () => {
        // sorted [1,2,3,4]; pos for q=0.5 → 1.5 → 2 + 0.5*(3−2) = 2.5.
        expect(reducePercentile(ringOf([1, 2, 3, 4]), 50)).toBe(2.5);
    });

    it("clamps p into [0, 100]", () => {
        const ring = ringOf([10, 20, 30]);
        expect(reducePercentile(ring, -5)).toBe(10);
        expect(reducePercentile(ring, 250)).toBe(30);
    });

    it("percentile of an empty window is NaN", () => {
        expect(reducePercentile(new Float64RingBuffer(2), 50)).toBeNaN();
    });

    it("single element → median and any percentile are that element", () => {
        const ring = ringOf([7]);
        expect(reduceMedian(ring)).toBe(7);
        expect(reducePercentile(ring, 25)).toBe(7);
    });
});

describe("array reductions — indexOf / includes", () => {
    it("indexOf returns the newest-relative index (0 = newest)", () => {
        const ring = ringOf([1, 2, 3]); // get(0)=3, get(1)=2, get(2)=1
        expect(reduceIndexOf(ring, 3)).toBe(0);
        expect(reduceIndexOf(ring, 1)).toBe(2);
    });

    it("indexOf returns -1 when absent and never finds NaN", () => {
        const ring = ringOf([1, Number.NaN, 3]);
        expect(reduceIndexOf(ring, 99)).toBe(-1);
        expect(reduceIndexOf(ring, Number.NaN)).toBe(-1);
    });

    it("includes finds present values", () => {
        const ring = ringOf([1, 2, 3]);
        expect(reduceIncludes(ring, 2)).toBe(true);
        expect(reduceIncludes(ring, 9)).toBe(false);
    });

    it("includes finds NaN (SameValueZero), unlike indexOf", () => {
        const ring = ringOf([1, Number.NaN, 3]);
        expect(reduceIncludes(ring, Number.NaN)).toBe(true);
        const noNaN = ringOf([1, 2, 3]);
        expect(reduceIncludes(noNaN, Number.NaN)).toBe(false);
    });
});

describe("array reductions — sort", () => {
    it("returns a fresh ascending copy by default", () => {
        expect(reduceSort(ringOf([3, 1, 2]))).toEqual([1, 2, 3]);
    });

    it("returns a descending copy when order === 'desc'", () => {
        expect(reduceSort(ringOf([3, 1, 2]), "desc")).toEqual([3, 2, 1]);
    });

    it("returns [] for an empty window", () => {
        expect(reduceSort(new Float64RingBuffer(2))).toEqual([]);
    });

    it("does not skip NaN — copies the whole filled region", () => {
        const ring = ringOf([2, Number.NaN, 1]);
        expect(reduceSort(ring)).toHaveLength(3);
    });
});

describe("array reductions — capacity eviction then reduce", () => {
    it("reduces only over the surviving (evicted) window", () => {
        const ring = ringOf([1, 2, 3, 4, 5], 3); // capacity 3 → window [3,4,5]
        expect(ring.length).toBe(3);
        expect(reduceSum(ring)).toBe(12);
        expect(reduceMin(ring)).toBe(3);
        expect(reduceMax(ring)).toBe(5);
    });
});

describe("array handle wiring", () => {
    it("delegates every method to the reduction helper over the tentative ring", () => {
        const slot = new ArrayStateSlot(8);
        for (const v of [2, 4, 4, 4, 5, 5, 7, 9]) slot.handle.push(v);
        const h = slot.handle;
        expect(h.sum()).toBe(40);
        expect(h.avg()).toBe(5);
        expect(h.min()).toBe(2);
        expect(h.max()).toBe(9);
        expect(h.range()).toBe(7);
        expect(h.variance()).toBeCloseTo(4, 12);
        expect(h.variance(false)).toBeCloseTo(32 / 7, 12);
        expect(h.stdev()).toBeCloseTo(2, 12);
        expect(h.stdev(false)).toBeCloseTo(Math.sqrt(32 / 7), 12);
        expect(h.median()).toBe(4.5);
        expect(h.percentile(0)).toBe(2);
        expect(h.percentile(100)).toBe(9);
        expect(h.indexOf(9)).toBe(0);
        expect(h.includes(7)).toBe(true);
        expect(h.sort()).toEqual([2, 4, 4, 4, 5, 5, 7, 9]);
        expect(h.sort("desc")).toEqual([9, 7, 5, 5, 4, 4, 4, 2]);
    });

    it("sort() never mutates the ring", () => {
        const slot = new ArrayStateSlot(4);
        for (const v of [3, 1, 2]) slot.handle.push(v);
        const before = slot.handle.get(0);
        slot.handle.sort();
        slot.handle.sort("desc");
        expect(slot.handle.get(0)).toBe(before);
        expect(slot.handle.get(0)).toBe(2);
        expect(slot.handle.get(2)).toBe(3);
        expect(slot.handle.size).toBe(3);
    });
});
