// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { wilderDirectional } from "./wilderDirectional.js";

const arbCandles = fc
    .integer({ min: 20, max: 60 })
    .chain((n) =>
        fc.tuple(
            fc.constant(n),
            fc.array(
                fc.tuple(
                    fc.double({ min: 1, max: 1000, noNaN: true }),
                    fc.double({ min: 1, max: 1000, noNaN: true }),
                    fc.double({ min: 0.1, max: 20, noNaN: true }),
                ),
                { minLength: n, maxLength: n },
            ),
        ),
    );

function build(
    n: number,
    tuples: ReadonlyArray<[number, number, number]>,
): {
    high: Float64Array;
    low: Float64Array;
    close: Float64Array;
} {
    const high = new Float64Array(n);
    const low = new Float64Array(n);
    const close = new Float64Array(n);
    for (let i = 0; i < n; i += 1) {
        const [open, c, spread] = tuples[i];
        high[i] = Math.max(open, c) + spread;
        low[i] = Math.min(open, c) - spread;
        close[i] = c;
    }
    return { close, high, low };
}

describe("wilderDirectional — property invariants", () => {
    it("output lengths equal input length", () => {
        fc.assert(
            fc.property(arbCandles, ([n, tuples]) => {
                const { high, low, close } = build(n, tuples);
                const out = wilderDirectional(high, low, close, 5);
                expect(out.plusDm.length).toBe(n);
                expect(out.minusDm.length).toBe(n);
                expect(out.plusDi.length).toBe(n);
                expect(out.minusDi.length).toBe(n);
            }),
        );
    });

    it("warmup [0, length-1] is NaN on every output", () => {
        fc.assert(
            fc.property(arbCandles, fc.integer({ min: 2, max: 8 }), ([n, tuples], length) => {
                const { high, low, close } = build(n, tuples);
                const out = wilderDirectional(high, low, close, length);
                for (let i = 0; i < Math.min(length, n); i += 1) {
                    expect(Number.isNaN(out.plusDm[i])).toBe(true);
                    expect(Number.isNaN(out.minusDm[i])).toBe(true);
                    expect(Number.isNaN(out.plusDi[i])).toBe(true);
                    expect(Number.isNaN(out.minusDi[i])).toBe(true);
                }
            }),
        );
    });

    it("is deterministic", () => {
        fc.assert(
            fc.property(arbCandles, ([n, tuples]) => {
                const { high, low, close } = build(n, tuples);
                const a = wilderDirectional(high, low, close, 5);
                const b = wilderDirectional(high, low, close, 5);
                expect(Array.from(a.plusDi)).toEqual(Array.from(b.plusDi));
                expect(Array.from(a.minusDi)).toEqual(Array.from(b.minusDi));
                expect(Array.from(a.plusDm)).toEqual(Array.from(b.plusDm));
                expect(Array.from(a.minusDm)).toEqual(Array.from(b.minusDm));
            }),
        );
    });

    it("plusDi / minusDi land in [0, 100] for valid slots", () => {
        fc.assert(
            fc.property(arbCandles, ([n, tuples]) => {
                const { high, low, close } = build(n, tuples);
                const length = 5;
                const out = wilderDirectional(high, low, close, length);
                for (let i = length; i < n; i += 1) {
                    if (Number.isFinite(out.plusDi[i])) {
                        expect(out.plusDi[i]).toBeGreaterThanOrEqual(0);
                        expect(out.plusDi[i]).toBeLessThanOrEqual(100);
                    }
                    if (Number.isFinite(out.minusDi[i])) {
                        expect(out.minusDi[i]).toBeGreaterThanOrEqual(0);
                        expect(out.minusDi[i]).toBeLessThanOrEqual(100);
                    }
                }
            }),
        );
    });

    it("plusDm / minusDm are non-negative for valid slots", () => {
        fc.assert(
            fc.property(arbCandles, ([n, tuples]) => {
                const { high, low, close } = build(n, tuples);
                const length = 5;
                const out = wilderDirectional(high, low, close, length);
                for (let i = length; i < n; i += 1) {
                    if (Number.isFinite(out.plusDm[i])) {
                        expect(out.plusDm[i]).toBeGreaterThanOrEqual(0);
                    }
                    if (Number.isFinite(out.minusDm[i])) {
                        expect(out.minusDm[i]).toBeGreaterThanOrEqual(0);
                    }
                }
            }),
        );
    });
});
