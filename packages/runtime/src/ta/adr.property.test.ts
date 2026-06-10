// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { adr } from "./adr.js";
import { harness } from "./__fixtures__/runPrimitive.js";

const MS_PER_DAY = 86_400_000;
const BASE = 1_699_920_000_000; // UTC midnight 2023-11-14

const arbDailyBar = fc
    .tuple(
        fc.integer({ min: 0, max: 50 }), // day offset
        fc.double({ min: 1, max: 100, noNaN: true }), // range
        fc.double({ min: 0, max: 1000, noNaN: true }), // base price
    )
    .map(
        ([day, range, base]): Bar => ({
            time: BASE + day * MS_PER_DAY,
            open: base,
            high: base + range,
            low: base,
            close: base,
            volume: 0,
            symbol: "T",
            interval: "1d",
        }),
    );

describe("ta.adr — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbDailyBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    () => adr("slot", { length: 14 }).current,
                );
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 30 },
        );
    });

    it("output is always ≥ 0 when defined", () => {
        fc.assert(
            fc.property(fc.array(arbDailyBar, { minLength: 30, maxLength: 80 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    () => adr("slot", { length: 5 }).current,
                );
                for (const v of out) {
                    if (Number.isFinite(v)) {
                        expect(v).toBeGreaterThanOrEqual(0);
                    }
                }
            }),
            { numRuns: 30 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbDailyBar, { minLength: 10, maxLength: 50 }), (bars) => {
                const a = harness(bars, bars.length + 1, () => adr("slot", { length: 5 }).current);
                const b = harness(bars, bars.length + 1, () => adr("slot", { length: 5 }).current);
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                    else expect(b[i]).toBe(a[i]);
                }
            }),
            { numRuns: 20 },
        );
    });

    it("one-bar-per-day in-order fixture: output equals brute-force SMA past warmup", () => {
        // Generate sequential daily bars (one per day, in order); the
        // committed daily range then equals `bar.high - bar.low` and the
        // ADR output is exactly the rolling SMA of those per-bar ranges.
        fc.assert(
            fc.property(
                fc.array(
                    fc.tuple(
                        fc.double({ min: 1, max: 100, noNaN: true }),
                        fc.double({ min: 0, max: 1000, noNaN: true }),
                    ),
                    { minLength: 20, maxLength: 40 },
                ),
                (pairs) => {
                    const length = 5;
                    const bars = pairs.map(([range, base], i) => ({
                        time: BASE + i * MS_PER_DAY,
                        open: base,
                        high: base + range,
                        low: base,
                        close: base,
                        volume: 0,
                        symbol: "T",
                        interval: "1d",
                    }));
                    const out = harness(
                        bars,
                        bars.length + 1,
                        () => adr("slot", { length }).current,
                    );
                    const ranges = pairs.map(([range]) => range);
                    // Each bar i commits the PRIOR day (i-1) when it
                    // starts; the in-progress day is never included. So
                    // ADR at bar i emits the SMA of ranges[i-length .. i-1]
                    // (window of `length` already-committed days).
                    for (let i = length; i < bars.length; i += 1) {
                        let sum = 0;
                        for (let j = i - length; j < i; j += 1) sum += ranges[j];
                        const expected = sum / length;
                        expect(out[i]).toBeCloseTo(expected, 9);
                    }
                },
            ),
            { numRuns: 20 },
        );
    });
});
