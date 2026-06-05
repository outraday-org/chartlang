// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { median } from "./median";

const arbBar = fc
    .tuple(fc.double({ min: 1, max: 1000, noNaN: true }), fc.integer({ min: 0, max: 60_000 }))
    .map(
        ([c, dt]): Bar => ({
            time: 1_700_000_000_000 + dt,
            open: c,
            high: c,
            low: c,
            close: c,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }),
    );

function bruteMedian(values: ReadonlyArray<number>): number {
    const finite: number[] = [];
    for (const v of values) if (Number.isFinite(v)) finite.push(v);
    if (finite.length === 0) return Number.NaN;
    finite.sort((a, b) => a - b);
    const k = finite.length;
    if (k % 2 === 1) return finite[(k - 1) >> 1];
    return (finite[(k >> 1) - 1] + finite[k >> 1]) / 2;
}

describe("ta.median — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => median("slot", bar.close, 4).current,
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
                        (bar) => median("slot", bar.close, length).current,
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

    it("incremental output equals brute-force rolling median within 1e-12", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 20, maxLength: 80 }), (bars) => {
                const length = 5;
                const actual = harness(
                    bars,
                    bars.length + 1,
                    (bar) => median("slot", bar.close, length).current,
                );
                for (let i = length - 1; i < bars.length; i += 1) {
                    const window: number[] = [];
                    for (let j = i - length + 1; j <= i; j += 1) {
                        window.push(bars[j].close);
                    }
                    const expected = bruteMedian(window);
                    expect(actual[i]).toBeCloseTo(expected, 10);
                }
            }),
            { numRuns: 30 },
        );
    });

    it("range invariant: min(window) ≤ median ≤ max(window) past warmup", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 50 }), (bars) => {
                const length = 4;
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => median("slot", bar.close, length).current,
                );
                for (let i = length - 1; i < bars.length; i += 1) {
                    let lo = Number.POSITIVE_INFINITY;
                    let hi = Number.NEGATIVE_INFINITY;
                    for (let j = i - length + 1; j <= i; j += 1) {
                        const v = bars[j].close;
                        if (v < lo) lo = v;
                        if (v > hi) hi = v;
                    }
                    expect(out[i]).toBeGreaterThanOrEqual(lo);
                    expect(out[i]).toBeLessThanOrEqual(hi);
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
                    (bar) => median("slot", bar.close, 4).current,
                );
                const b = harness(
                    bars,
                    bars.length + 1,
                    (bar) => median("slot", bar.close, 4).current,
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
