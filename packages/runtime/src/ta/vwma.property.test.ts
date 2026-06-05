// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { computeSmaOfFloat64 } from "./lib/smaFloat64";
import { vwmaFloat64 } from "./lib/vwmaFloat64";
import { vwma } from "./vwma";

const arbBar = fc
    .tuple(
        fc.double({ min: 1, max: 1000, noNaN: true }),
        fc.double({ min: 1, max: 100_000, noNaN: true }),
        fc.integer({ min: 0, max: 60_000 }),
    )
    .map(
        ([close, volume, dt], _i): Bar => ({
            time: 1_700_000_000_000 + dt,
            open: close,
            high: close,
            low: close,
            close,
            volume,
            symbol: "T",
            interval: "1m",
        }),
    );

describe("ta.vwma — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => vwma("slot", bar.close, 4).current,
                );
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 30 },
        );
    });

    it("warmup is `length - 1` NaN slots when sources are finite", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 50 }),
                fc.integer({ min: 1, max: 10 }),
                (bars, length) => {
                    const out = harness(
                        bars,
                        bars.length + 1,
                        (bar) => vwma("slot", bar.close, length).current,
                    );
                    for (let i = 0; i < length - 1 && i < out.length; i += 1) {
                        expect(Number.isNaN(out[i])).toBe(true);
                    }
                },
            ),
            { numRuns: 30 },
        );
    });

    it("incremental output equals vwmaFloat64 reference within 1e-8", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 20, maxLength: 80 }), (bars) => {
                const closes = new Float64Array(bars.map((b) => b.close));
                const volumes = new Float64Array(bars.map((b) => b.volume));
                const expected = vwmaFloat64(closes, volumes, 5);
                const actual = harness(
                    bars,
                    bars.length + 1,
                    (bar) => vwma("slot", bar.close, 5).current,
                );
                for (let i = 0; i < bars.length; i += 1) {
                    if (Number.isNaN(expected[i])) expect(Number.isNaN(actual[i])).toBe(true);
                    else expect(actual[i]).toBeCloseTo(expected[i], 8);
                }
            }),
            { numRuns: 30 },
        );
    });

    it("collapses to SMA when every bar has the same positive volume", () => {
        fc.assert(
            fc.property(
                fc.array(fc.double({ min: 1, max: 1000, noNaN: true }), {
                    minLength: 10,
                    maxLength: 50,
                }),
                (closes) => {
                    const bars: Bar[] = closes.map((c, i) => ({
                        time: 1_700_000_000_000 + i * 60_000,
                        open: c,
                        high: c,
                        low: c,
                        close: c,
                        volume: 100,
                        symbol: "T",
                        interval: "1m",
                    }));
                    const closesArr = new Float64Array(closes);
                    const expectedSma = computeSmaOfFloat64(closesArr, 5);
                    const actual = harness(
                        bars,
                        bars.length + 1,
                        (bar) => vwma("slot", bar.close, 5).current,
                    );
                    for (let i = 0; i < bars.length; i += 1) {
                        if (Number.isNaN(expectedSma[i]))
                            expect(Number.isNaN(actual[i])).toBe(true);
                        else expect(actual[i]).toBeCloseTo(expectedSma[i], 8);
                    }
                },
            ),
            { numRuns: 20 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 50 }), (bars) => {
                const a = harness(
                    bars,
                    bars.length + 1,
                    (bar) => vwma("slot", bar.close, 4).current,
                );
                const b = harness(
                    bars,
                    bars.length + 1,
                    (bar) => vwma("slot", bar.close, 4).current,
                );
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                    else expect(b[i]).toBe(a[i]);
                }
            }),
            { numRuns: 20 },
        );
    });
});
