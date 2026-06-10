// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { bucketLtfBarsByMainContainment } from "./bucketLtfBarsByMainContainment.js";

const bar = (time: number): Bar => ({
    time,
    open: 1,
    high: 1,
    low: 1,
    close: 1,
    volume: 1,
    symbol: "S",
    interval: "x",
    hl2: 1,
    hlc3: 1,
    ohlc4: 1,
    hlcc4: 1,
});

describe("bucketLtfBarsByMainContainment", () => {
    it("handles empty inputs", () => {
        expect(bucketLtfBarsByMainContainment([], [])).toEqual([]);
        expect(bucketLtfBarsByMainContainment([bar(0), bar(60)], [])).toEqual([[], []]);
    });

    it("buckets half-open windows", () => {
        const result = bucketLtfBarsByMainContainment(
            [bar(0), bar(60), bar(120)],
            [bar(-1), bar(0), bar(30), bar(60), bar(90), bar(120), bar(150)],
        );
        expect(result.map((bucket) => bucket.map((b) => b.time))).toEqual([
            [0, 30],
            [60, 90],
            [120, 150],
        ]);
    });

    it("drops all pre-history bars", () => {
        expect(bucketLtfBarsByMainContainment([bar(10), bar(20)], [bar(0), bar(5)])).toEqual([
            [],
            [],
        ]);
    });
});
