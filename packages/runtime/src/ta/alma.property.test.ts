// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { alma } from "./alma.js";

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

function referenceAlma(
    input: Float64Array,
    length: number,
    offsetCentre: number,
    sigma: number,
): Float64Array {
    const n = input.length;
    const out = new Float64Array(n);
    out.fill(Number.NaN);
    const m = offsetCentre * (length - 1);
    const s = length / sigma;
    const weights = new Float64Array(length);
    let normaliser = 0;
    for (let j = 0; j < length; j += 1) {
        weights[j] = Math.exp(-((j - m) ** 2) / (2 * s * s));
        normaliser += weights[j];
    }
    for (let i = length - 1; i < n; i += 1) {
        let sum = 0;
        let bad = false;
        for (let j = 0; j < length; j += 1) {
            const v = input[i - length + 1 + j];
            if (!Number.isFinite(v)) {
                bad = true;
                break;
            }
            sum += v * weights[j];
        }
        out[i] = bad ? Number.NaN : sum / normaliser;
    }
    return out;
}

describe("ta.alma — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => alma("slot", bar.close, 5).current,
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
                fc.integer({ min: 2, max: 10 }),
                (bars, length) => {
                    const out = harness(
                        bars,
                        bars.length + 1,
                        (bar) => alma("slot", bar.close, length).current,
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

    it("incremental output equals the reference ALMA within 1e-8", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 20, maxLength: 60 }), (bars) => {
                const closes = new Float64Array(bars.map((b) => b.close));
                const expected = referenceAlma(closes, 9, 0.85, 6);
                const actual = harness(
                    bars,
                    bars.length + 1,
                    (bar) => alma("slot", bar.close, 9).current,
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
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 50 }), (bars) => {
                const a = harness(
                    bars,
                    bars.length + 1,
                    (bar) => alma("slot", bar.close, 5).current,
                );
                const b = harness(
                    bars,
                    bars.length + 1,
                    (bar) => alma("slot", bar.close, 5).current,
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
