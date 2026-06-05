// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { dema } from "./dema";
import { computeEmaOfFloat64 } from "./lib/emaFloat64";

const arbBar = fc
    .tuple(fc.double({ min: 1, max: 1000, noNaN: true }), fc.integer({ min: 0, max: 60_000 }))
    .map(
        ([close, dt], _i): Bar => ({
            time: 1_700_000_000_000 + dt,
            open: close,
            high: close,
            low: close,
            close,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }),
    );

function referenceDema(input: Float64Array, length: number): Float64Array {
    const ema1 = computeEmaOfFloat64(input, length);
    const ema2 = computeEmaOfFloat64(ema1, length);
    const out = new Float64Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
        const e1 = ema1[i];
        const e2 = ema2[i];
        out[i] = Number.isFinite(e1) && Number.isFinite(e2) ? 2 * e1 - e2 : Number.NaN;
    }
    return out;
}

describe("ta.dema — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => dema("slot", bar.close, 4).current,
                );
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 30 },
        );
    });

    it("warmup is `2·length − 2` NaN slots when sources are finite", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 30, maxLength: 80 }),
                fc.integer({ min: 2, max: 8 }),
                (bars, length) => {
                    const out = harness(
                        bars,
                        bars.length + 1,
                        (bar) => dema("slot", bar.close, length).current,
                    );
                    const warmup = 2 * length - 2;
                    for (let i = 0; i < warmup && i < out.length; i += 1) {
                        expect(Number.isNaN(out[i])).toBe(true);
                    }
                    if (out.length > warmup) {
                        expect(Number.isFinite(out[warmup])).toBe(true);
                    }
                },
            ),
            { numRuns: 30 },
        );
    });

    it("incremental output equals the reference DEMA within 1e-8", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 30, maxLength: 80 }), (bars) => {
                const closes = new Float64Array(bars.map((b) => b.close));
                const expected = referenceDema(closes, 5);
                const actual = harness(
                    bars,
                    bars.length + 1,
                    (bar) => dema("slot", bar.close, 5).current,
                );
                for (let i = 0; i < bars.length; i += 1) {
                    if (Number.isNaN(expected[i])) expect(Number.isNaN(actual[i])).toBe(true);
                    else expect(actual[i]).toBeCloseTo(expected[i], 8);
                }
            }),
            { numRuns: 30 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 20, maxLength: 60 }), (bars) => {
                const a = harness(
                    bars,
                    bars.length + 1,
                    (bar) => dema("slot", bar.close, 4).current,
                );
                const b = harness(
                    bars,
                    bars.length + 1,
                    (bar) => dema("slot", bar.close, 4).current,
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
