// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { computeSmaOfFloat64 } from "./smaFloat64";
import { vwmaFloat64 } from "./vwmaFloat64";

const arbFinite = fc.double({ min: 1, max: 1000, noNaN: true });
const arbPositiveVol = fc.double({ min: 1, max: 10_000, noNaN: true });
const arbLength = fc.integer({ min: 2, max: 12 });

describe("vwmaFloat64 — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(
                fc.array(arbFinite, { minLength: 5, maxLength: 60 }),
                arbLength,
                (values, length) => {
                    const src = new Float64Array(values);
                    const vol = new Float64Array(values.length).fill(1);
                    const out = vwmaFloat64(src, vol, length);
                    expect(out.length).toBe(values.length);
                },
            ),
        );
    });

    it("warmup is exactly length - 1 NaN slots for all-finite input + positive volume", () => {
        fc.assert(
            fc.property(
                fc.array(arbFinite, { minLength: 15, maxLength: 50 }),
                arbLength,
                (values, length) => {
                    const src = new Float64Array(values);
                    const vol = new Float64Array(values.length).fill(1);
                    const out = vwmaFloat64(src, vol, length);
                    for (let i = 0; i < length - 1 && i < out.length; i += 1) {
                        expect(Number.isNaN(out[i])).toBe(true);
                    }
                    if (out.length >= length) {
                        expect(Number.isFinite(out[length - 1])).toBe(true);
                    }
                },
            ),
        );
    });

    it("constant source + positive volume yields constant output post-warmup", () => {
        fc.assert(
            fc.property(
                fc.double({ min: 1, max: 1000, noNaN: true }),
                fc.array(arbPositiveVol, { minLength: 20, maxLength: 50 }),
                arbLength,
                (constant, volumes, length) => {
                    const src = new Float64Array(volumes.length).fill(constant);
                    const vol = new Float64Array(volumes);
                    const out = vwmaFloat64(src, vol, length);
                    for (let i = length - 1; i < src.length; i += 1) {
                        expect(out[i]).toBeCloseTo(constant, 10);
                    }
                },
            ),
        );
    });

    it("constant volume reduces to SMA: vwmaFloat64(src, [k,k,…], N) === computeSmaOfFloat64(src, N)", () => {
        fc.assert(
            fc.property(
                fc.array(arbFinite, { minLength: 20, maxLength: 60 }),
                fc.double({ min: 1, max: 100, noNaN: true }),
                arbLength,
                (values, k, length) => {
                    const src = new Float64Array(values);
                    const vol = new Float64Array(values.length).fill(k);
                    const vwma = vwmaFloat64(src, vol, length);
                    const sma = computeSmaOfFloat64(src, length);
                    for (let i = 0; i < src.length; i += 1) {
                        if (Number.isNaN(sma[i])) {
                            expect(Number.isNaN(vwma[i])).toBe(true);
                        } else {
                            expect(vwma[i]).toBeCloseTo(sma[i], 8);
                        }
                    }
                },
            ),
        );
    });

    it("determinism: same input → bitwise-identical output", () => {
        fc.assert(
            fc.property(
                fc.array(arbFinite, { minLength: 10, maxLength: 50 }),
                arbLength,
                (values, length) => {
                    const src = new Float64Array(values);
                    const vol = new Float64Array(values.map((_, i) => 1 + (i % 5)));
                    const a = vwmaFloat64(src, vol, length);
                    const b = vwmaFloat64(src, vol, length);
                    expect(a.length).toBe(b.length);
                    for (let i = 0; i < a.length; i += 1) {
                        if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                        else expect(b[i]).toBe(a[i]);
                    }
                },
            ),
        );
    });

    it("NaN source at index i ⇒ out[i] is NaN", () => {
        fc.assert(
            fc.property(
                fc.array(arbFinite, { minLength: 20, maxLength: 40 }),
                fc.integer({ min: 5, max: 15 }),
                arbLength,
                (values, nanIdx, length) => {
                    const clamped = Math.min(nanIdx, values.length - 1);
                    const src = new Float64Array(values);
                    src[clamped] = Number.NaN;
                    const vol = new Float64Array(values.length).fill(1);
                    const out = vwmaFloat64(src, vol, length);
                    expect(Number.isNaN(out[clamped])).toBe(true);
                },
            ),
        );
    });
});
