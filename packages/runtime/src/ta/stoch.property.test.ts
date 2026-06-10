// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { stoch } from "./stoch.js";

const arbBar = fc
    .tuple(
        fc.double({ min: 10, max: 1000, noNaN: true }),
        fc.double({ min: 0, max: 5, noNaN: true }),
        fc.integer({ min: 0, max: 60_000 }),
    )
    .map(
        ([close, spread, dt]): Bar => ({
            time: 1_700_000_000_000 + dt,
            open: close,
            high: close + spread,
            low: close - spread,
            close,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }),
    );

// Floating-point slack for the [0, 100] band — composed sma layers
// accumulate per-step error on pathological flat-window samples.
const STOCH_EPS = 1e-9;

describe("ta.stoch — property invariants", () => {
    it("k ∈ [0, 100] (or NaN) for every emitted bar", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 20, maxLength: 80 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => stoch("slot").k.current);
                for (const v of out) {
                    if (Number.isFinite(v)) {
                        expect(v).toBeGreaterThanOrEqual(-STOCH_EPS);
                        expect(v).toBeLessThanOrEqual(100 + STOCH_EPS);
                    }
                }
            }),
            { numRuns: 20 },
        );
    });

    it("d ∈ [0, 100] (or NaN) for every emitted bar", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 20, maxLength: 80 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => stoch("slot").d.current);
                for (const v of out) {
                    if (Number.isFinite(v)) {
                        expect(v).toBeGreaterThanOrEqual(-STOCH_EPS);
                        expect(v).toBeLessThanOrEqual(100 + STOCH_EPS);
                    }
                }
            }),
            { numRuns: 20 },
        );
    });

    it("determinism: same input → identical k + d output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 20, maxLength: 50 }), (bars) => {
                const a = harness(bars, bars.length + 1, () => {
                    const s = stoch("slot");
                    return { k: s.k.current, d: s.d.current };
                });
                const b = harness(bars, bars.length + 1, () => {
                    const s = stoch("slot");
                    return { k: s.k.current, d: s.d.current };
                });
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i].k)) expect(Number.isNaN(b[i].k)).toBe(true);
                    else expect(b[i].k).toBe(a[i].k);
                    if (Number.isNaN(a[i].d)) expect(Number.isNaN(b[i].d)).toBe(true);
                    else expect(b[i].d).toBe(a[i].d);
                }
            }),
            { numRuns: 15 },
        );
    });
});
