// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { sessionVolumeProfile } from "./sessionVolumeProfile.js";

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

describe("ta.sessionVolumeProfile — property invariants", () => {
    it("conserves positive volume in the current session buckets", () => {
        fc.assert(
            fc.property(fc.array(arbProfileBar, { minLength: 4, maxLength: 40 }), (rawBars) => {
                const bars = withTimes(rawBars);
                const sessionStart = bars[0].time;
                const out = harness(bars, bars.length + 1, () => {
                    const result = sessionVolumeProfile("slot", { sessionStart });
                    return result.buckets;
                });
                const buckets = out[out.length - 1];
                if (buckets === undefined) throw new Error("missing property output");
                const bucketSum = buckets.reduce((sum, bucket) => sum + bucket.volume, 0);
                const volumeSum = bars
                    .slice(1)
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

    it("emits NaN at the first bar of a new session", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 8; i += 1) {
            const close = 100 + i;
            bars.push({
                close,
                high: close + 0.25,
                interval: "1m",
                low: close - 0.25,
                open: close,
                symbol: "T",
                time: 1_700_000_000_000 + i * MINUTE_MS,
                volume: 1_000,
            });
        }
        const secondSessionStart = bars[4].time;
        const out = harness(bars, 16, (_bar, _ctx) => {
            const sessionStart =
                _bar.time >= secondSessionStart ? secondSessionStart : bars[0].time;
            return sessionVolumeProfile("slot", { sessionStart }).poc.current;
        });
        expect(out[0]).toBeNaN();
        expect(out[4]).toBeNaN();
    });

    it("has monotonic non-decreasing POC under monotonic price input within one session", () => {
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
                time: 1_700_000_000_000 + i * MINUTE_MS,
                volume: 1_000 + i,
            });
        }
        const out = harness(
            bars,
            64,
            () => sessionVolumeProfile("slot", { sessionStart: bars[0].time }).poc.current,
        ).filter(Number.isFinite);
        for (let i = 1; i < out.length; i += 1) {
            expect(out[i]).toBeGreaterThanOrEqual(out[i - 1]);
        }
    });
});
