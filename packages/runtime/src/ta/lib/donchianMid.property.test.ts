// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { donchianMid } from "./donchianMid.js";

const arbPairs = fc.integer({ min: 10, max: 60 }).chain((n) =>
    fc.tuple(
        fc.constant(n),
        fc.array(fc.double({ min: 1, max: 1000, noNaN: true }), {
            minLength: n,
            maxLength: n,
        }),
        fc.array(fc.double({ min: 0.1, max: 20, noNaN: true }), {
            minLength: n,
            maxLength: n,
        }),
    ),
);

describe("donchianMid — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(arbPairs, ([n, opens, spreads]) => {
                const high = new Float64Array(opens.map((o, i) => o + spreads[i]));
                const low = new Float64Array(opens.map((o, i) => o - spreads[i]));
                const out = donchianMid(high, low, 5);
                expect(out.length).toBe(n);
            }),
        );
    });

    it("warmup slots [0, length-2] are NaN", () => {
        fc.assert(
            fc.property(arbPairs, fc.integer({ min: 2, max: 8 }), ([n, opens, spreads], length) => {
                const high = new Float64Array(opens.map((o, i) => o + spreads[i]));
                const low = new Float64Array(opens.map((o, i) => o - spreads[i]));
                const out = donchianMid(high, low, length);
                for (let i = 0; i < Math.min(length - 1, n); i += 1) {
                    expect(Number.isNaN(out[i])).toBe(true);
                }
            }),
        );
    });

    it("is deterministic — same input yields the same output", () => {
        fc.assert(
            fc.property(arbPairs, ([_n, opens, spreads]) => {
                const high = new Float64Array(opens.map((o, i) => o + spreads[i]));
                const low = new Float64Array(opens.map((o, i) => o - spreads[i]));
                const a = donchianMid(high, low, 5);
                const b = donchianMid(high, low, 5);
                expect(Array.from(a)).toEqual(Array.from(b));
            }),
        );
    });

    it("midpoint lies inside [min(low), max(high)] for valid slots", () => {
        fc.assert(
            fc.property(arbPairs, ([n, opens, spreads]) => {
                const high = new Float64Array(opens.map((o, i) => o + spreads[i]));
                const low = new Float64Array(opens.map((o, i) => o - spreads[i]));
                const length = 5;
                const out = donchianMid(high, low, length);
                for (let i = length - 1; i < n; i += 1) {
                    if (!Number.isFinite(out[i])) continue;
                    let hi = high[i];
                    let lo = low[i];
                    for (let j = i - length + 1; j < i; j += 1) {
                        if (high[j] > hi) hi = high[j];
                        if (low[j] < lo) lo = low[j];
                    }
                    expect(out[i]).toBeGreaterThanOrEqual(lo);
                    expect(out[i]).toBeLessThanOrEqual(hi);
                }
            }),
        );
    });
});
