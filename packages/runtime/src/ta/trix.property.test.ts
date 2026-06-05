// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { computeEmaOfFloat64 } from "./lib/emaFloat64";
import { trix } from "./trix";
import { harness } from "./__fixtures__/runPrimitive";

const arbCloseBar = fc
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

function referenceTrix(closes: Float64Array, length: number): Float64Array {
    const ema1 = computeEmaOfFloat64(closes, length);
    const ema2 = computeEmaOfFloat64(ema1, length);
    const ema3 = computeEmaOfFloat64(ema2, length);
    const out = new Float64Array(closes.length);
    out.fill(Number.NaN);
    for (let i = 1; i < closes.length; i += 1) {
        const prev = ema3[i - 1];
        const cur = ema3[i];
        if (Number.isFinite(prev) && Number.isFinite(cur) && prev !== 0) {
            out[i] = (100 * (cur - prev)) / prev;
        }
    }
    return out;
}

describe("ta.trix — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbCloseBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => trix("slot", bar.close, 4).trix.current,
                );
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 25 },
        );
    });

    it("trix line is unbounded (no fixed range invariant) — sanity: finite where defined", () => {
        fc.assert(
            fc.property(
                fc.array(arbCloseBar, { minLength: 30, maxLength: 80 }),
                fc.integer({ min: 2, max: 8 }),
                (bars, length) => {
                    const out = harness(
                        bars,
                        bars.length + 1,
                        (bar) => trix("slot", bar.close, length).trix.current,
                    );
                    for (const v of out) {
                        if (Number.isFinite(v)) {
                            expect(Number.isFinite(v)).toBe(true);
                        }
                    }
                },
            ),
            { numRuns: 20 },
        );
    });

    it("warmup: trix line first defined at `3·length − 2`", () => {
        fc.assert(
            fc.property(
                fc.array(arbCloseBar, { minLength: 30, maxLength: 60 }),
                fc.integer({ min: 2, max: 6 }),
                (bars, length) => {
                    const out = harness(
                        bars,
                        bars.length + 1,
                        (bar) => trix("slot", bar.close, length).trix.current,
                    );
                    // ema3 first defined at 3·length − 3; trix needs prevEma3 → first defined at 3·length − 2.
                    const trixWarmup = 3 * length - 2;
                    for (let i = 0; i < trixWarmup && i < out.length; i += 1) {
                        expect(Number.isNaN(out[i])).toBe(true);
                    }
                    if (out.length > trixWarmup) {
                        expect(Number.isFinite(out[trixWarmup])).toBe(true);
                    }
                },
            ),
            { numRuns: 20 },
        );
    });

    it("incremental output equals the reference triple-EMA TRIX within 1e-8", () => {
        fc.assert(
            fc.property(fc.array(arbCloseBar, { minLength: 30, maxLength: 60 }), (bars) => {
                const closes = new Float64Array(bars.map((b) => b.close));
                const expected = referenceTrix(closes, 5);
                const actual = harness(
                    bars,
                    bars.length + 1,
                    (bar) => trix("slot", bar.close, 5).trix.current,
                );
                for (let i = 0; i < bars.length; i += 1) {
                    if (Number.isNaN(expected[i])) {
                        expect(Number.isNaN(actual[i])).toBe(true);
                    } else {
                        expect(actual[i]).toBeCloseTo(expected[i], 8);
                    }
                }
            }),
            { numRuns: 20 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbCloseBar, { minLength: 15, maxLength: 50 }), (bars) => {
                const a = harness(
                    bars,
                    bars.length + 1,
                    (bar) => trix("slot", bar.close, 5).trix.current,
                );
                const b = harness(
                    bars,
                    bars.length + 1,
                    (bar) => trix("slot", bar.close, 5).trix.current,
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
