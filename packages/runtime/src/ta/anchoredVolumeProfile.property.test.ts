// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { anchoredVolumeProfile } from "./anchoredVolumeProfile.js";

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
        time: 1_700_000_000_000 + index * 60_000,
    }));
}

function bucketVolumesAtHead(
    bars: ReadonlyArray<Bar>,
    anchorIndex: number,
): {
    readonly buckets: ReadonlyArray<{ readonly price: number; readonly volume: number }>;
    readonly poc: number;
} {
    const anchor = bars[anchorIndex].time;
    const out = harness(bars, bars.length + 1, () => {
        const result = anchoredVolumeProfile("slot", { anchor });
        return {
            buckets: result.buckets,
            poc: result.poc.current,
        };
    });
    const head = out[out.length - 1];
    if (head === undefined) throw new Error("missing property output");
    return head;
}

describe("ta.anchoredVolumeProfile — property invariants", () => {
    it("keeps pre-anchor POC / VAH / VAL values as NaN", () => {
        fc.assert(
            fc.property(fc.array(arbProfileBar, { minLength: 4, maxLength: 40 }), (rawBars) => {
                const bars = withTimes(rawBars);
                const anchorIndex = Math.max(1, Math.floor(bars.length / 2));
                const anchor = bars[anchorIndex].time;
                const out = harness(bars, bars.length + 1, () => {
                    const result = anchoredVolumeProfile("slot", { anchor });
                    return {
                        poc: result.poc.current,
                        valHigh: result.valHigh.current,
                        valLow: result.valLow.current,
                    };
                });
                for (let i = 0; i <= anchorIndex; i += 1) {
                    expect(Number.isNaN(out[i].poc)).toBe(true);
                    expect(Number.isNaN(out[i].valHigh)).toBe(true);
                    expect(Number.isNaN(out[i].valLow)).toBe(true);
                }
            }),
            { numRuns: 25 },
        );
    });

    it("conserves post-anchor positive volume in emitted buckets", () => {
        fc.assert(
            fc.property(fc.array(arbProfileBar, { minLength: 4, maxLength: 40 }), (rawBars) => {
                const bars = withTimes(rawBars);
                const anchorIndex = Math.floor(bars.length / 2);
                const result = bucketVolumesAtHead(bars, anchorIndex);
                const bucketSum = result.buckets.reduce((sum, bucket) => sum + bucket.volume, 0);
                const volumeSum = bars
                    .slice(anchorIndex)
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

    it("has monotonic non-decreasing POC under monotonic price input", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 40; i += 1) {
            const close = 100 + i;
            bars.push({
                close,
                high: close + 0.25,
                interval: "1m",
                low: close - 0.25,
                open: close,
                symbol: "T",
                time: 1_700_000_000_000 + i * 60_000,
                volume: 1_000 + i,
            });
        }
        const out = harness(
            bars,
            64,
            () => anchoredVolumeProfile("slot", { anchor: bars[0].time }).poc.current,
        ).filter(Number.isFinite);
        for (let i = 1; i < out.length; i += 1) {
            expect(out[i]).toBeGreaterThanOrEqual(out[i - 1]);
        }
    });
});
