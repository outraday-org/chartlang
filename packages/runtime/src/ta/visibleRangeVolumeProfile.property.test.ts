// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { visibleRangeVolumeProfile } from "./visibleRangeVolumeProfile.js";

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

function bucketVolumesAtHead(
    bars: ReadonlyArray<Bar>,
    valueAreaPct = 0.7,
): {
    readonly buckets: ReadonlyArray<{ readonly price: number; readonly volume: number }>;
    readonly poc: number;
    readonly valHigh: number;
    readonly valLow: number;
} {
    const out = harness(bars, bars.length + 1, (_bar, ctx) => {
        const result = visibleRangeVolumeProfile("slot", { valueAreaPct });
        const plot = ctx.emissions.plots[ctx.emissions.plots.length - 1];
        const buckets =
            plot !== undefined && plot.style.kind === "horizontal-histogram"
                ? plot.style.buckets
                : [];
        return {
            buckets,
            poc: result.poc.current,
            valHigh: result.valHigh.current,
            valLow: result.valLow.current,
        };
    });
    const head = out[out.length - 1];
    if (head === undefined) throw new Error("missing property output");
    return head;
}

describe("ta.visibleRangeVolumeProfile — property invariants", () => {
    it("conserves total positive volume in emitted buckets", () => {
        fc.assert(
            fc.property(fc.array(arbProfileBar, { minLength: 2, maxLength: 40 }), (bars) => {
                const result = bucketVolumesAtHead(bars);
                const bucketSum = result.buckets.reduce((sum, bucket) => sum + bucket.volume, 0);
                const volumeSum = bars.reduce(
                    (sum, bar) =>
                        sum + (Number.isFinite(bar.volume) && bar.volume > 0 ? bar.volume : 0),
                    0,
                );
                expect(bucketSum).toBeCloseTo(volumeSum, 8);
            }),
            { numRuns: 25 },
        );
    });

    it("keeps POC inside the input high/low range when defined", () => {
        fc.assert(
            fc.property(fc.array(arbProfileBar, { minLength: 2, maxLength: 40 }), (bars) => {
                const result = bucketVolumesAtHead(bars);
                if (!Number.isFinite(result.poc)) return;
                const minLow = Math.min(...bars.map((bar) => bar.low));
                const maxHigh = Math.max(...bars.map((bar) => bar.high));
                expect(result.poc).toBeGreaterThanOrEqual(minLow);
                expect(result.poc).toBeLessThanOrEqual(maxHigh);
            }),
            { numRuns: 25 },
        );
    });

    it("value-area buckets cover at least valueAreaPct × total volume", () => {
        fc.assert(
            fc.property(fc.array(arbProfileBar, { minLength: 2, maxLength: 40 }), (bars) => {
                const valueAreaPct = 0.7;
                const result = bucketVolumesAtHead(bars, valueAreaPct);
                const total = result.buckets.reduce((sum, bucket) => sum + bucket.volume, 0);
                if (
                    total <= 0 ||
                    !Number.isFinite(result.valLow) ||
                    !Number.isFinite(result.valHigh)
                ) {
                    return;
                }
                const valueAreaVolume = result.buckets.reduce(
                    (sum, bucket) =>
                        bucket.price >= result.valLow && bucket.price <= result.valHigh
                            ? sum + bucket.volume
                            : sum,
                    0,
                );
                expect(valueAreaVolume).toBeGreaterThanOrEqual(total * valueAreaPct - 1e-7);
            }),
            { numRuns: 25 },
        );
    });
});
