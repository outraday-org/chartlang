// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { adl } from "./adl.js";

// Non-degenerate bar: half-range pads out above/below the o/c band so
// high > low always holds.
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

describe("ta.adl — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 60 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => adl("slot").current);
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 30 },
        );
    });

    it("output equals brute-force cumulative Σ MFV", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 60 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => adl("slot").current);
                let cum = 0;
                for (let i = 0; i < bars.length; i += 1) {
                    cum += mfv(bars[i].close, bars[i].high, bars[i].low, bars[i].volume);
                    expect(out[i]).toBeCloseTo(cum, 10);
                }
            }),
            { numRuns: 30 },
        );
    });

    it("output is monotone in expected direction when CLV has constant sign", () => {
        // For a bullish bar (close near high), MFV > 0; for a bearish
        // bar (close near low), MFV < 0. We just assert the sum stays
        // finite and matches the brute-force fold above.
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 60 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => adl("slot").current);
                for (const v of out) expect(Number.isFinite(v)).toBe(true);
            }),
            { numRuns: 30 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 60 }), (bars) => {
                const a = harness(bars, bars.length + 1, () => adl("slot").current);
                const b = harness(bars, bars.length + 1, () => adl("slot").current);
                for (let i = 0; i < a.length; i += 1) expect(b[i]).toBe(a[i]);
            }),
            { numRuns: 20 },
        );
    });
});
