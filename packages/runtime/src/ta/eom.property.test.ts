// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { eom } from "./eom";

const DIVISOR = 10000;

const arbBar = fc
    .tuple(
        fc.double({ min: 100, max: 200, noNaN: true }),
        fc.double({ min: 0.5, max: 10, noNaN: true }),
        fc.integer({ min: 1, max: 100_000 }),
        fc.integer({ min: 0, max: 60_000 }),
    )
    .map(
        ([mid, halfRange, v, dt]): Bar => ({
            time: 1_700_000_000_000 + dt,
            open: mid,
            high: mid + halfRange,
            low: mid - halfRange,
            close: mid,
            volume: v,
            symbol: "T",
            interval: "1m",
        }),
    );

const rawEom = (high: number, low: number, volume: number, prevMid: number): number => {
    const range = high - low;
    if (range === 0) return Number.NaN;
    const boxRatio = volume / DIVISOR / range;
    if (boxRatio === 0) return Number.NaN;
    return ((high + low) / 2 - prevMid) / boxRatio;
};

describe("ta.eom — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => eom("slot", 5).current);
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 30 },
        );
    });

    it("emits NaN for the first `length` bars", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 6, maxLength: 60 }), (bars) => {
                const length = 5;
                const out = harness(bars, bars.length + 1, () => eom("slot", length).current);
                for (let i = 0; i < length; i += 1) {
                    expect(Number.isNaN(out[i])).toBe(true);
                }
            }),
            { numRuns: 30 },
        );
    });

    it("matches brute-force trailing-window SMA over rawEom", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 6, maxLength: 40 }), (bars) => {
                const length = 4;
                const out = harness(bars, bars.length + 1, () => eom("slot", length).current);
                // Precompute rawEom series.
                const raws: number[] = [Number.NaN];
                for (let i = 1; i < bars.length; i += 1) {
                    const prevMid = (bars[i - 1].high + bars[i - 1].low) / 2;
                    raws.push(rawEom(bars[i].high, bars[i].low, bars[i].volume, prevMid));
                }
                for (let i = length; i < bars.length; i += 1) {
                    let sum = 0;
                    let anyNan = false;
                    for (let j = i - length + 1; j <= i; j += 1) {
                        if (!Number.isFinite(raws[j])) {
                            anyNan = true;
                            break;
                        }
                        sum += raws[j];
                    }
                    const expected = anyNan ? Number.NaN : sum / length;
                    if (Number.isNaN(expected)) {
                        expect(Number.isNaN(out[i])).toBe(true);
                    } else {
                        expect(out[i]).toBeCloseTo(expected, 6);
                    }
                }
            }),
            { numRuns: 20 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 40 }), (bars) => {
                const a = harness(bars, bars.length + 1, () => eom("slot", 5).current);
                const b = harness(bars, bars.length + 1, () => eom("slot", 5).current);
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                    else expect(b[i]).toBe(a[i]);
                }
            }),
            { numRuns: 15 },
        );
    });
});
