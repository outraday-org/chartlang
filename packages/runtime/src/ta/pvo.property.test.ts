// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { pvo } from "./pvo.js";

describe("ta.pvo — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 5, max: 60 }),
                fc.integer({ min: 1, max: 999 }),
                (n, seed) => {
                    const bars = syntheticBars(n, seed);
                    const out = harness(bars, bars.length + 1, () => pvo("slot").pvo.current);
                    expect(out.length).toBe(bars.length);
                },
            ),
            { numRuns: 15 },
        );
    });

    it("warmup respects slowLength: bars 0..slowLength-2 are NaN", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 4, max: 20 }),
                fc.integer({ min: 1, max: 999 }),
                (slow, seed) => {
                    const bars = syntheticBars(slow + 5, seed);
                    const out = harness(
                        bars,
                        bars.length + 1,
                        () => pvo("slot", { fastLength: 2, slowLength: slow }).pvo.current,
                    );
                    for (let i = 0; i < slow - 1; i += 1) expect(Number.isNaN(out[i])).toBe(true);
                },
            ),
            { numRuns: 15 },
        );
    });

    it("hist = pvo - signal where both defined", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 35, max: 80 }),
                fc.integer({ min: 1, max: 999 }),
                (n, seed) => {
                    const bars = syntheticBars(n, seed);
                    const out = harness(bars, bars.length + 1, () => {
                        const p = pvo("slot");
                        return {
                            pvo: p.pvo.current,
                            signal: p.signal.current,
                            hist: p.hist.current,
                        };
                    });
                    for (const { pvo: pv, signal, hist } of out) {
                        if (Number.isFinite(pv) && Number.isFinite(signal)) {
                            expect(hist).toBeCloseTo(pv - signal, 10);
                        }
                    }
                },
            ),
            { numRuns: 15 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 10, max: 50 }),
                fc.integer({ min: 1, max: 999 }),
                (n, seed) => {
                    const bars = syntheticBars(n, seed);
                    const a = harness(bars, bars.length + 1, () => pvo("slot").pvo.current);
                    const b = harness(bars, bars.length + 1, () => pvo("slot").pvo.current);
                    for (let i = 0; i < a.length; i += 1) {
                        if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                        else expect(b[i]).toBe(a[i]);
                    }
                },
            ),
            { numRuns: 15 },
        );
    });
});
