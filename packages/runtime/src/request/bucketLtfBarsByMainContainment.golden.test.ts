// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Golden capture procedure: the bucket-size arrays below were computed by
// hand from the half-open containment policy `[main[i].time, main[i+1].time)`
// (final bucket absorbs every remaining LTF bar) and are pinned so any future
// kernel change that shifts bucketing is caught as golden drift.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { bucketLtfBarsByMainContainment } from "./bucketLtfBarsByMainContainment.js";

function makeBar(time: number, interval: string): Bar {
    return {
        time,
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        volume: 1,
        symbol: "TEST",
        interval,
        hl2: 1,
        hlc3: 1,
        ohlc4: 1,
        hlcc4: 1,
    };
}

function makeBars(count: number, stepMs: number, interval: string): ReadonlyArray<Bar> {
    return Array.from({ length: count }, (_, i) => makeBar(i * stepMs, interval));
}

describe("bucketLtfBarsByMainContainment — goldens", () => {
    it("buckets 60 minutes of 15s LTF bars into 1m main bars (4 per bucket)", () => {
        const main = makeBars(60, 60_000, "1m");
        const ltf = makeBars(240, 15_000, "15s");

        const buckets = bucketLtfBarsByMainContainment(main, ltf);

        expect(buckets.map((bucket) => bucket.length)).toEqual(Array.from({ length: 60 }, () => 4));
        expect(buckets[0]?.map((bar) => bar.time)).toEqual([0, 15_000, 30_000, 45_000]);
        expect(buckets[59]?.map((bar) => bar.time)).toEqual([
            3_540_000, 3_555_000, 3_570_000, 3_585_000,
        ]);
    });

    it("buckets a 1m LTF stream with a 12-bar outage gap into 5m main bars", () => {
        const main = makeBars(12, 300_000, "5m");
        const ltf = makeBars(60, 60_000, "1m").filter((bar) => {
            const minute = bar.time / 60_000;
            return minute < 20 || minute >= 32;
        });

        const buckets = bucketLtfBarsByMainContainment(main, ltf);

        expect(buckets.map((bucket) => bucket.length)).toEqual([
            5, 5, 5, 5, 0, 0, 3, 5, 5, 5, 5, 5,
        ]);
        expect(buckets[6]?.map((bar) => bar.time)).toEqual([1_920_000, 1_980_000, 2_040_000]);
    });

    it("grows the in-progress final bucket as new 5m LTF bars arrive under 1H main bars", () => {
        const main = makeBars(3, 3_600_000, "1H");
        const before = makeBars(30, 300_000, "5m");
        const after = makeBars(31, 300_000, "5m");

        const bucketsBefore = bucketLtfBarsByMainContainment(main, before);
        const bucketsAfter = bucketLtfBarsByMainContainment(main, after);

        expect(bucketsBefore.map((bucket) => bucket.length)).toEqual([12, 12, 6]);
        expect(bucketsAfter.map((bucket) => bucket.length)).toEqual([12, 12, 7]);
        expect(bucketsAfter[2]?.at(-1)?.time).toBe(9_000_000);
    });
});
