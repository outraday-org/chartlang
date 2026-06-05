// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { vwap } from "./vwap";

const MS_PER_DAY = 86_400_000;
const DAY_START = Math.floor(1_700_000_000_000 / MS_PER_DAY) * MS_PER_DAY;

// Day-anchored bar — every bar lands inside the same UTC day so the
// invariants don't have to reason about session resets.
const arbBar = fc
    .tuple(
        fc.double({ min: 1, max: 1000, noNaN: true }),
        fc.integer({ min: 1, max: 100_000 }),
        fc.integer({ min: 0, max: 60_000 }),
    )
    .map(
        ([c, v, dt], _i): Bar => ({
            time: DAY_START + dt,
            open: c,
            high: c,
            low: c,
            close: c,
            volume: v,
            symbol: "T",
            interval: "1m",
        }),
    );

describe("ta.vwap — property invariants (no session reset)", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 30 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => vwap("slot").current);
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 30 },
        );
    });

    it("output equals brute-force Σ(hlc3·v)/Σ(v) over the day", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 30 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => vwap("slot").current);
                let pv = 0;
                let v = 0;
                for (let i = 0; i < bars.length; i += 1) {
                    const bar = bars[i];
                    const hlc3 = (bar.high + bar.low + bar.close) / 3;
                    pv += hlc3 * bar.volume;
                    v += bar.volume;
                    const expected = v === 0 ? Number.NaN : pv / v;
                    if (Number.isNaN(expected)) expect(Number.isNaN(out[i])).toBe(true);
                    else expect(out[i]).toBeCloseTo(expected, 10);
                }
            }),
            { numRuns: 30 },
        );
    });

    it("vwap is bounded by the per-bar source values seen so far", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 30 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => vwap("slot").current);
                let lo = Number.POSITIVE_INFINITY;
                let hi = Number.NEGATIVE_INFINITY;
                for (let i = 0; i < bars.length; i += 1) {
                    const bar = bars[i];
                    const hlc3 = (bar.high + bar.low + bar.close) / 3;
                    if (bar.volume > 0) {
                        if (hlc3 < lo) lo = hlc3;
                        if (hlc3 > hi) hi = hlc3;
                    }
                    if (Number.isFinite(out[i])) {
                        expect(out[i]).toBeGreaterThanOrEqual(lo - 1e-9);
                        expect(out[i]).toBeLessThanOrEqual(hi + 1e-9);
                    }
                }
            }),
            { numRuns: 30 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 30 }), (bars) => {
                const a = harness(bars, bars.length + 1, () => vwap("slot").current);
                const b = harness(bars, bars.length + 1, () => vwap("slot").current);
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                    else expect(b[i]).toBe(a[i]);
                }
            }),
            { numRuns: 20 },
        );
    });
});
