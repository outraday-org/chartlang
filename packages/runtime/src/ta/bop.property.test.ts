// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { bop } from "./bop";

// Each bar carries (open, close, half-range, dt) where the half-range
// adds equally above max(open, close) and below min(open, close) so
// the bar is non-degenerate (high > low) with high finite probability.
const arbBar = fc
    .tuple(
        fc.double({ min: 1, max: 1000, noNaN: true }),
        fc.double({ min: 1, max: 1000, noNaN: true }),
        fc.double({ min: 0.1, max: 10, noNaN: true }),
        fc.integer({ min: 0, max: 60_000 }),
    )
    .map(
        ([o, c, halfRange, dt]): Bar => ({
            time: 1_700_000_000_000 + dt,
            open: o,
            high: Math.max(o, c) + halfRange,
            low: Math.min(o, c) - halfRange,
            close: c,
            volume: 100,
            symbol: "T",
            interval: "1m",
        }),
    );

describe("ta.bop — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 60 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => bop("slot").current);
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 30 },
        );
    });

    it("output is bounded by [-1, 1]", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 60 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => bop("slot").current);
                for (let i = 0; i < out.length; i += 1) {
                    if (Number.isFinite(out[i])) {
                        expect(out[i]).toBeGreaterThanOrEqual(-1 - 1e-9);
                        expect(out[i]).toBeLessThanOrEqual(1 + 1e-9);
                    }
                }
            }),
            { numRuns: 30 },
        );
    });

    it("output equals brute-force (C - O) / (H - L) per bar", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 60 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => bop("slot").current);
                for (let i = 0; i < bars.length; i += 1) {
                    const bar = bars[i];
                    const range = bar.high - bar.low;
                    const expected = range === 0 ? 0 : (bar.close - bar.open) / range;
                    if (Number.isNaN(expected)) expect(Number.isNaN(out[i])).toBe(true);
                    else expect(out[i]).toBeCloseTo(expected, 10);
                }
            }),
            { numRuns: 30 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 60 }), (bars) => {
                const a = harness(bars, bars.length + 1, () => bop("slot").current);
                const b = harness(bars, bars.length + 1, () => bop("slot").current);
                for (let i = 0; i < a.length; i += 1) expect(b[i]).toBe(a[i]);
            }),
            { numRuns: 20 },
        );
    });
});
