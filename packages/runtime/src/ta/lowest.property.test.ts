// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { lowest } from "./lowest.js";

const arbBar = fc
    .tuple(fc.double({ min: 1, max: 1000, noNaN: true }), fc.integer({ min: 0, max: 60_000 }))
    .map(
        ([l, dt], _i): Bar => ({
            time: 1_700_000_000_000 + dt,
            open: l,
            high: l,
            low: l,
            close: l,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }),
    );

describe("ta.lowest — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => lowest("slot", bar.low, 4).current,
                );
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 30 },
        );
    });

    it("warmup is `length - 1` NaN slots when sources are finite", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 50 }),
                fc.integer({ min: 1, max: 10 }),
                (bars, length) => {
                    const out = harness(
                        bars,
                        bars.length + 1,
                        (bar) => lowest("slot", bar.low, length).current,
                    );
                    for (let i = 0; i < length - 1 && i < out.length; i += 1) {
                        expect(Number.isNaN(out[i])).toBe(true);
                    }
                    if (out.length >= length) {
                        expect(Number.isFinite(out[length - 1])).toBe(true);
                    }
                },
            ),
            { numRuns: 30 },
        );
    });

    it("incremental output equals brute-force rolling min within 1e-12", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 20, maxLength: 80 }), (bars) => {
                const length = 5;
                const actual = harness(
                    bars,
                    bars.length + 1,
                    (bar) => lowest("slot", bar.low, length).current,
                );
                for (let i = length - 1; i < bars.length; i += 1) {
                    let expected = Number.POSITIVE_INFINITY;
                    for (let j = i - length + 1; j <= i; j += 1) {
                        expected = Math.min(expected, bars[j].low);
                    }
                    expect(actual[i]).toBeCloseTo(expected, 10);
                }
            }),
            { numRuns: 30 },
        );
    });

    it("output is always less than or equal to current source past warmup", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 50 }), (bars) => {
                const length = 4;
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => lowest("slot", bar.low, length).current,
                );
                for (let i = length - 1; i < bars.length; i += 1) {
                    expect(out[i]).toBeLessThanOrEqual(bars[i].low);
                }
            }),
            { numRuns: 30 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 50 }), (bars) => {
                const a = harness(
                    bars,
                    bars.length + 1,
                    (bar) => lowest("slot", bar.low, 4).current,
                );
                const b = harness(
                    bars,
                    bars.length + 1,
                    (bar) => lowest("slot", bar.low, 4).current,
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
