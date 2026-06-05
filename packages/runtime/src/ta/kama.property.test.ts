// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { kama } from "./kama";

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

function referenceKama(
    src: Float64Array,
    length: number,
    fastLength: number,
    slowLength: number,
): Float64Array {
    const n = src.length;
    const out = new Float64Array(n);
    out.fill(Number.NaN);
    const fast = 2 / (fastLength + 1);
    const slow = 2 / (slowLength + 1);
    let prev = Number.NaN;
    for (let i = length; i < n; i += 1) {
        const headSrc = src[i];
        const oldest = src[i - length];
        if (!Number.isFinite(headSrc) || !Number.isFinite(oldest)) {
            out[i] = prev;
            continue;
        }
        const change = Math.abs(headSrc - oldest);
        let vol = 0;
        for (let j = 0; j < length; j += 1) {
            vol += Math.abs(src[i - j] - src[i - j - 1]);
        }
        const er = vol > 0 ? change / vol : 0;
        const sc = (er * (fast - slow) + slow) ** 2;
        if (!Number.isFinite(prev)) prev = headSrc;
        else prev = prev + sc * (headSrc - prev);
        out[i] = prev;
    }
    return out;
}

describe("ta.kama — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 15, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => kama("slot", bar.close, { length: 5 }).current,
                );
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 30 },
        );
    });

    it("warmup is `length` NaN slots when sources are finite", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 30, maxLength: 60 }),
                fc.integer({ min: 3, max: 10 }),
                (bars, length) => {
                    const out = harness(
                        bars,
                        bars.length + 1,
                        (bar) => kama("slot", bar.close, { length }).current,
                    );
                    for (let i = 0; i < length && i < out.length; i += 1) {
                        expect(Number.isNaN(out[i])).toBe(true);
                    }
                    if (out.length > length) {
                        expect(Number.isFinite(out[length])).toBe(true);
                    }
                },
            ),
            { numRuns: 30 },
        );
    });

    it("incremental output equals the reference KAMA within 1e-8", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 30, maxLength: 80 }), (bars) => {
                const closes = new Float64Array(bars.map((b) => b.close));
                const expected = referenceKama(closes, 5, 2, 30);
                const actual = harness(
                    bars,
                    bars.length + 1,
                    (bar) => kama("slot", bar.close, { length: 5 }).current,
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
                    (bar) => kama("slot", bar.close, { length: 5 }).current,
                );
                const b = harness(
                    bars,
                    bars.length + 1,
                    (bar) => kama("slot", bar.close, { length: 5 }).current,
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
