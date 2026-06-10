// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { cmf } from "./cmf.js";

const arbBar = fc
    .tuple(
        fc.double({ min: 1, max: 1000, noNaN: true }),
        fc.double({ min: 1, max: 1000, noNaN: true }),
        fc.double({ min: 0.1, max: 10, noNaN: true }),
        fc.integer({ min: 1, max: 100_000 }),
        fc.integer({ min: 0, max: 60_000 }),
    )
    .map(
        ([o, c, halfRange, v, dt]): Bar => ({
            time: 1_700_000_000_000 + dt,
            open: o,
            high: Math.max(o, c) + halfRange,
            low: Math.min(o, c) - halfRange,
            close: c,
            volume: v,
            symbol: "T",
            interval: "1m",
        }),
    );

const mfv = (close: number, high: number, low: number, volume: number): number => {
    const range = high - low;
    if (range === 0) return 0;
    return ((close - low - (high - close)) / range) * volume;
};

describe("ta.cmf — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => cmf("slot", 5).current);
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 30 },
        );
    });

    it("emits NaN for the first `length - 1` bars", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => cmf("slot", 5).current);
                for (let i = 0; i < 4; i += 1) {
                    expect(Number.isNaN(out[i])).toBe(true);
                }
            }),
            { numRuns: 30 },
        );
    });

    it("output is bounded by [-1, 1]", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => cmf("slot", 5).current);
                for (const v of out) {
                    if (Number.isFinite(v)) {
                        expect(v).toBeGreaterThanOrEqual(-1 - 1e-9);
                        expect(v).toBeLessThanOrEqual(1 + 1e-9);
                    }
                }
            }),
            { numRuns: 30 },
        );
    });

    it("matches brute-force trailing-window Σ MFV / Σ vol", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => cmf("slot", 5).current);
                for (let i = 4; i < bars.length; i += 1) {
                    let sumMfv = 0;
                    let sumVol = 0;
                    for (let j = i - 4; j <= i; j += 1) {
                        sumMfv += mfv(bars[j].close, bars[j].high, bars[j].low, bars[j].volume);
                        sumVol += bars[j].volume;
                    }
                    const expected = sumVol === 0 ? Number.NaN : sumMfv / sumVol;
                    if (Number.isNaN(expected)) {
                        expect(Number.isNaN(out[i])).toBe(true);
                    } else {
                        expect(out[i]).toBeCloseTo(expected, 9);
                    }
                }
            }),
            { numRuns: 20 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const a = harness(bars, bars.length + 1, () => cmf("slot", 5).current);
                const b = harness(bars, bars.length + 1, () => cmf("slot", 5).current);
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                    else expect(b[i]).toBe(a[i]);
                }
            }),
            { numRuns: 20 },
        );
    });
});
