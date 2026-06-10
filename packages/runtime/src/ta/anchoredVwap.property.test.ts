// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { anchoredVwap } from "./anchoredVwap.js";
import { harness } from "./__fixtures__/runPrimitive.js";

const T0 = 1_700_000_000_000;

const arbBar = fc
    .tuple(
        fc.double({ min: 1, max: 1000, noNaN: true }),
        fc.integer({ min: 1, max: 100_000 }),
        fc.integer({ min: 0, max: 60_000 }),
    )
    .map(
        ([c, v, dt], _i): Bar => ({
            time: T0 + dt,
            open: c,
            high: c,
            low: c,
            close: c,
            volume: v,
            symbol: "T",
            interval: "1m",
        }),
    );

describe("ta.anchoredVwap — property invariants (anchor at first bar)", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 30 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    () => anchoredVwap("slot", bars[0].time).current,
                );
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 30 },
        );
    });

    it("output equals brute-force running Σ(hlc3·v)/Σ(v) over bars at-or-after the anchor", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 30 }), (bars) => {
                const anchor = bars[0].time;
                const out = harness(
                    bars,
                    bars.length + 1,
                    () => anchoredVwap("slot", anchor).current,
                );
                let pv = 0;
                let v = 0;
                let started = false;
                for (let i = 0; i < bars.length; i += 1) {
                    const bar = bars[i];
                    if (bar.time >= anchor) {
                        const hlc3 = (bar.high + bar.low + bar.close) / 3;
                        pv += hlc3 * bar.volume;
                        v += bar.volume;
                        started = true;
                    }
                    const expected = !started || v === 0 ? Number.NaN : pv / v;
                    if (Number.isNaN(expected)) expect(Number.isNaN(out[i])).toBe(true);
                    else expect(out[i]).toBeCloseTo(expected, 10);
                }
            }),
            { numRuns: 30 },
        );
    });

    it("bars at indices before the first-bar-with-time-≥-anchor emit NaN", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 3, maxLength: 30 }),
                fc.integer({ min: 1, max: 5 }),
                (bars, lateIdx) => {
                    const idx = Math.min(lateIdx, bars.length - 1);
                    const anchor = bars[idx].time;
                    const out = harness(
                        bars,
                        bars.length + 1,
                        () => anchoredVwap("slot", anchor).current,
                    );
                    // The slot only emits NaN at indices BEFORE the first
                    // bar with `time >= anchor`. Once `started` flips,
                    // even bars with `time < anchor` (out-of-order arbBar
                    // times are possible) leave the cum intact, so output
                    // stays finite (= the running vwap).
                    let firstActive = -1;
                    for (let i = 0; i < bars.length; i += 1) {
                        if (bars[i].time >= anchor) {
                            firstActive = i;
                            break;
                        }
                    }
                    if (firstActive === -1) {
                        for (let i = 0; i < bars.length; i += 1) {
                            expect(Number.isNaN(out[i])).toBe(true);
                        }
                        return;
                    }
                    for (let i = 0; i < firstActive; i += 1) {
                        expect(Number.isNaN(out[i])).toBe(true);
                    }
                },
            ),
            { numRuns: 30 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 30 }), (bars) => {
                const anchor = bars[0].time;
                const a = harness(
                    bars,
                    bars.length + 1,
                    () => anchoredVwap("slot", anchor).current,
                );
                const b = harness(
                    bars,
                    bars.length + 1,
                    () => anchoredVwap("slot", anchor).current,
                );
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                    else expect(b[i]).toBe(a[i]);
                }
            }),
            { numRuns: 20 },
        );
    });
});
