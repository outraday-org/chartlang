// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hma } from "./hma.js";
import { wmaFloat64 } from "./lib/wmaFloat64.js";

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

function referenceHma(closes: Float64Array, length: number): Float64Array {
    const halfLen = Math.max(1, Math.floor(length / 2));
    const sqrtLen = Math.max(1, Math.round(Math.sqrt(length)));
    const half = wmaFloat64(closes, halfLen);
    const full = wmaFloat64(closes, length);
    const diff = new Float64Array(closes.length);
    for (let i = 0; i < closes.length; i += 1) {
        const h = half[i];
        const f = full[i];
        diff[i] = Number.isFinite(h) && Number.isFinite(f) ? 2 * h - f : Number.NaN;
    }
    return wmaFloat64(diff, sqrtLen);
}

describe("ta.hma — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 50 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => hma("slot", bar.close, 9).current,
                );
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 30 },
        );
    });

    it("incremental output equals the reference HMA within 1e-8", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 25, maxLength: 80 }), (bars) => {
                const length = 9;
                const closes = new Float64Array(bars.map((b) => b.close));
                const expected = referenceHma(closes, length);
                const actual = harness(
                    bars,
                    bars.length + 1,
                    (bar) => hma("slot", bar.close, length).current,
                );
                for (let i = 0; i < bars.length; i += 1) {
                    if (Number.isNaN(expected[i])) expect(Number.isNaN(actual[i])).toBe(true);
                    else expect(actual[i]).toBeCloseTo(expected[i], 8);
                }
            }),
            { numRuns: 20 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 15, maxLength: 40 }), (bars) => {
                const a = harness(
                    bars,
                    bars.length + 1,
                    (bar) => hma("slot", bar.close, 9).current,
                );
                const b = harness(
                    bars,
                    bars.length + 1,
                    (bar) => hma("slot", bar.close, 9).current,
                );
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                    else expect(b[i]).toBe(a[i]);
                }
            }),
            { numRuns: 15 },
        );
    });
});
