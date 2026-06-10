// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { pearson } from "./lib/pearson.js";
import { trendStrengthIndex } from "./trendStrengthIndex.js";

const arbCloseBar = fc.double({ min: 1, max: 1000, noNaN: true }).map(
    (close, _i): Bar => ({
        time: 1_700_000_000_000,
        open: close,
        high: close,
        low: close,
        close,
        volume: 0,
        symbol: "T",
        interval: "1m",
    }),
);

function referenceTsi(closes: Float64Array, length: number): Float64Array {
    const n = closes.length;
    const indices = new Float64Array(n);
    for (let i = 0; i < n; i += 1) indices[i] = i;
    return pearson(closes, indices, length);
}

describe("ta.trendStrengthIndex — property invariants", () => {
    it("output ∈ [-1, +1] where defined", () => {
        fc.assert(
            fc.property(
                fc.array(arbCloseBar, { minLength: 10, maxLength: 60 }),
                fc.integer({ min: 2, max: 12 }),
                (bars, length) => {
                    const out = harness(
                        bars,
                        bars.length + 1,
                        (bar) => trendStrengthIndex("slot", bar.close, length).current,
                    );
                    for (const v of out) {
                        if (Number.isFinite(v)) {
                            expect(v).toBeGreaterThanOrEqual(-1);
                            expect(v).toBeLessThanOrEqual(1);
                        }
                    }
                },
            ),
            { numRuns: 25 },
        );
    });

    it("warmup: first `length - 1` outputs are NaN", () => {
        fc.assert(
            fc.property(
                fc.array(arbCloseBar, { minLength: 10, maxLength: 40 }),
                fc.integer({ min: 2, max: 8 }),
                (bars, length) => {
                    const out = harness(
                        bars,
                        bars.length + 1,
                        (bar) => trendStrengthIndex("slot", bar.close, length).current,
                    );
                    for (let i = 0; i < length - 1 && i < out.length; i += 1) {
                        expect(Number.isNaN(out[i])).toBe(true);
                    }
                },
            ),
            { numRuns: 25 },
        );
    });

    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbCloseBar, { minLength: 5, maxLength: 30 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => trendStrengthIndex("slot", bar.close, 5).current,
                );
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 20 },
        );
    });

    it("incremental output equals the reference Pearson-vs-index within 1e-8", () => {
        fc.assert(
            fc.property(
                fc.array(arbCloseBar, { minLength: 15, maxLength: 50 }),
                fc.integer({ min: 2, max: 8 }),
                (bars, length) => {
                    const closes = new Float64Array(bars.map((b) => b.close));
                    const expected = referenceTsi(closes, length);
                    const actual = harness(
                        bars,
                        bars.length + 1,
                        (bar) => trendStrengthIndex("slot", bar.close, length).current,
                    );
                    for (let i = 0; i < bars.length; i += 1) {
                        if (Number.isNaN(expected[i])) {
                            expect(Number.isNaN(actual[i])).toBe(true);
                        } else {
                            expect(actual[i]).toBeCloseTo(expected[i], 8);
                        }
                    }
                },
            ),
            { numRuns: 20 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbCloseBar, { minLength: 10, maxLength: 40 }), (bars) => {
                const a = harness(
                    bars,
                    bars.length + 1,
                    (bar) => trendStrengthIndex("slot", bar.close, 5).current,
                );
                const b = harness(
                    bars,
                    bars.length + 1,
                    (bar) => trendStrengthIndex("slot", bar.close, 5).current,
                );
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                    else expect(b[i]).toBe(a[i]);
                }
            }),
            { numRuns: 15 },
        );
    });
});
