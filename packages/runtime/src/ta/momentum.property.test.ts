// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { momentum } from "./momentum.js";

const arbBar = fc
    .tuple(fc.double({ min: 1, max: 1000, noNaN: true }), fc.integer({ min: 0, max: 60_000 }))
    .map(
        ([c, dt], _i): Bar => ({
            time: 1_700_000_000_000 + dt,
            open: c,
            high: c,
            low: c,
            close: c,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }),
    );

describe("ta.momentum — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => momentum("slot", bar.close, 3).current,
                );
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 30 },
        );
    });

    it("warmup is `length` NaN slots", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 50 }),
                fc.integer({ min: 1, max: 6 }),
                (bars, length) => {
                    const out = harness(
                        bars,
                        bars.length + 1,
                        (bar) => momentum("slot", bar.close, length).current,
                    );
                    for (let i = 0; i < length && i < out.length; i += 1) {
                        expect(Number.isNaN(out[i])).toBe(true);
                    }
                    if (out.length > length) {
                        expect(Number.isFinite(out[length])).toBe(true);
                    }
                },
            ),
            { numRuns: 30 },
        );
    });

    it("matches brute-force `src[i] - src[i - length]`", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 50 }),
                fc.integer({ min: 1, max: 6 }),
                (bars, length) => {
                    const out = harness(
                        bars,
                        bars.length + 1,
                        (bar) => momentum("slot", bar.close, length).current,
                    );
                    for (let i = length; i < bars.length; i += 1) {
                        expect(out[i]).toBeCloseTo(bars[i].close - bars[i - length].close, 10);
                    }
                },
            ),
            { numRuns: 30 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 50 }), (bars) => {
                const a = harness(
                    bars,
                    bars.length + 1,
                    (bar) => momentum("slot", bar.close, 4).current,
                );
                const b = harness(
                    bars,
                    bars.length + 1,
                    (bar) => momentum("slot", bar.close, 4).current,
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
