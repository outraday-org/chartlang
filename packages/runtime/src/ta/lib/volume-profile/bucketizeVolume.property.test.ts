// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/bucketize-volume.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { bucketizeVolumeDetailed } from "./bucketizeVolume.js";
import type { VolumeProfileBar } from "./types.js";

const arbBars = fc
    .array(
        fc.record({
            base: fc.double({ max: 200, min: 10, noNaN: true }),
            span: fc.double({ max: 5, min: 0.1, noNaN: true }),
            volume: fc.double({ max: 10_000, min: 0, noNaN: true }),
        }),
        { maxLength: 50, minLength: 1 },
    )
    .map(
        (items): Array<VolumeProfileBar> =>
            items.map((item, index) => ({
                close: item.base + item.span * 0.75,
                high: item.base + item.span,
                low: item.base,
                open: item.base + item.span * 0.25,
                time: index,
                volume: item.volume,
            })),
    );

describe("bucketizeVolume — property invariants", () => {
    it("conserves finite non-negative input volume when all bars fit the bucket range", () => {
        fc.assert(
            fc.property(arbBars, (bars) => {
                const result = bucketizeVolumeDetailed(bars, new Float64Array([0, 250]), "upDown");
                const expected = bars.reduce((sum, item) => sum + item.volume, 0);
                expect(result.totalVolume).toBeCloseTo(expected, 6);
            }),
        );
    });

    it("returns buckets monotonic in price", () => {
        fc.assert(
            fc.property(arbBars, (bars) => {
                const result = bucketizeVolumeDetailed(
                    bars,
                    new Float64Array([0, 50, 100, 150, 200, 250]),
                    "total",
                );
                for (let i = 1; i < result.buckets.length; i += 1) {
                    expect(result.buckets[i].price).toBeGreaterThan(result.buckets[i - 1].price);
                }
            }),
        );
    });
});
