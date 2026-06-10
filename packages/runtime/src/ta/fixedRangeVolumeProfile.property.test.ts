// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { fixedRangeVolumeProfile } from "./fixedRangeVolumeProfile.js";

const MINUTE_MS = 60_000;

const arbProfileBar: fc.Arbitrary<Bar> = fc
    .tuple(
        fc.double({ min: 50, max: 150, noNaN: true }),
        fc.double({ min: -1, max: 1, noNaN: true }),
        fc.integer({ min: 0, max: 10_000 }),
    )
    .map(([base, delta, volume]) => {
        const close = base + delta;
        return {
            close,
            high: close + 0.25,
            interval: "1m",
            low: close - 0.25,
            open: base,
            symbol: "T",
            time: 1_700_000_000_000,
            volume,
        };
    });

function withTimes(bars: ReadonlyArray<Bar>): Bar[] {
    return bars.map((bar, index) => ({
        ...bar,
        time: 1_700_000_000_000 + index * MINUTE_MS,
    }));
}

describe("ta.fixedRangeVolumeProfile — property invariants", () => {
    it("conserves positive volume in the fixed range buckets", () => {
        fc.assert(
            fc.property(fc.array(arbProfileBar, { minLength: 8, maxLength: 40 }), (rawBars) => {
                const bars = withTimes(rawBars);
                const fromIndex = Math.floor(bars.length / 4);
                const toIndex = Math.floor((bars.length * 3) / 4);
                const out = harness(bars, bars.length + 1, () => {
                    const result = fixedRangeVolumeProfile("slot", {
                        from: bars[fromIndex].time,
                        to: bars[toIndex].time,
                    });
                    return result.buckets;
                });
                const buckets = out[out.length - 1];
                if (buckets === undefined) throw new Error("missing property output");
                const bucketSum = buckets.reduce((sum, bucket) => sum + bucket.volume, 0);
                const volumeSum = bars
                    .slice(fromIndex, toIndex + 1)
                    .reduce(
                        (sum, bar) =>
                            sum + (Number.isFinite(bar.volume) && bar.volume > 0 ? bar.volume : 0),
                        0,
                    );
                expect(bucketSum).toBeCloseTo(volumeSum, 8);
            }),
            { numRuns: 25 },
        );
    });

    it("freezes bucket snapshots after opts.to", () => {
        fc.assert(
            fc.property(fc.array(arbProfileBar, { minLength: 8, maxLength: 40 }), (rawBars) => {
                const bars = withTimes(rawBars);
                const fromIndex = Math.floor(bars.length / 4);
                const toIndex = Math.floor(bars.length / 2);
                const out = harness(bars, bars.length + 1, () => {
                    const result = fixedRangeVolumeProfile("slot", {
                        from: bars[fromIndex].time,
                        to: bars[toIndex].time,
                    });
                    return JSON.stringify(result.buckets);
                });
                for (let i = toIndex + 1; i < out.length; i += 1) {
                    expect(out[i]).toBe(out[toIndex]);
                }
            }),
            { numRuns: 25 },
        );
    });

    it("keeps pre-from POC / VAH / VAL values as NaN", () => {
        fc.assert(
            fc.property(fc.array(arbProfileBar, { minLength: 8, maxLength: 40 }), (rawBars) => {
                const bars = withTimes(rawBars);
                const fromIndex = Math.floor(bars.length / 2);
                const toIndex = bars.length - 1;
                const out = harness(bars, bars.length + 1, () => {
                    const result = fixedRangeVolumeProfile("slot", {
                        from: bars[fromIndex].time,
                        to: bars[toIndex].time,
                    });
                    return {
                        poc: result.poc.current,
                        valHigh: result.valHigh.current,
                        valLow: result.valLow.current,
                    };
                });
                for (let i = 0; i < fromIndex; i += 1) {
                    expect(Number.isNaN(out[i].poc)).toBe(true);
                    expect(Number.isNaN(out[i].valHigh)).toBe(true);
                    expect(Number.isNaN(out[i].valLow)).toBe(true);
                }
            }),
            { numRuns: 25 },
        );
    });
});
