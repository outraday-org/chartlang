// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
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

describe("bucketLtfBarsByMainContainment properties", () => {
    it("preserves ordered non-prehistory LTF bars", () => {
        fc.assert(
            fc.property(
                fc
                    .uniqueArray(fc.integer({ min: 0, max: 1_000 }), { maxLength: 50 })
                    .map((xs) => xs.sort((a, b) => a - b)),
                fc
                    .uniqueArray(fc.integer({ min: -100, max: 1_200 }), { maxLength: 200 })
                    .map((xs) => xs.sort((a, b) => a - b)),
                (mainTimes, ltfTimes) => {
                    const main = mainTimes.map(bar);
                    const ltf = ltfTimes.map(bar);
                    const buckets = bucketLtfBarsByMainContainment(main, ltf);
                    if (main.length === 0) {
                        expect(buckets).toEqual([]);
                        return;
                    }
                    const flattened = buckets.flat();
                    expect(flattened.map((b) => b.time)).toEqual(
                        ltfTimes.filter((t) => t >= mainTimes[0]),
                    );
                    for (let i = 0; i < buckets.length; i += 1) {
                        for (const b of buckets[i]) {
                            expect(b.time).toBeGreaterThanOrEqual(main[i].time);
                            if (i + 1 < main.length) expect(b.time).toBeLessThan(main[i + 1].time);
                        }
                    }
                },
            ),
            { seed: 42 },
        );
    });
});
