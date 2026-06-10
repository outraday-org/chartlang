// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { pmo } from "./pmo.js";

const arbBar = fc
    .tuple(fc.double({ min: 1, max: 1000, noNaN: true }), fc.integer({ min: 0, max: 60_000 }))
    .map(
        ([c, dt]): Bar => ({
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

describe("ta.pmo — property invariants", () => {
    it("output length equals input length on both series", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 70, maxLength: 120 }), (bars) => {
                const out = harness(bars, bars.length + 1, (bar) => {
                    const p = pmo("slot", bar.close);
                    return { pmo: p.pmo.current, signal: p.signal.current };
                });
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 15 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 70, maxLength: 100 }), (bars) => {
                const a = harness(
                    bars,
                    bars.length + 1,
                    (bar) => pmo("slot", bar.close).pmo.current,
                );
                const b = harness(
                    bars,
                    bars.length + 1,
                    (bar) => pmo("slot", bar.close).pmo.current,
                );
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                    else expect(b[i]).toBe(a[i]);
                }
            }),
            { numRuns: 10 },
        );
    });

    it("pmo line warms at firstSmoothing + secondSmoothing − 1 bars (bar 0's NaN roc1 burns one bar of the inner Swenlin EMA seed)", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 70, maxLength: 100 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) =>
                        pmo("slot", bar.close, {
                            firstSmoothing: 5,
                            secondSmoothing: 4,
                            signalLength: 3,
                        }).pmo.current,
                );
                // pmo warmup = 5 + 4 − 1 = 8 bars NaN (bar 0's roc1 is
                // NaN — the prev source is undefined — so the inner
                // Swenlin EMA's seed-count advance starts at bar 1, not
                // bar 0).
                for (let i = 0; i < 8 && i < out.length; i += 1) {
                    expect(Number.isNaN(out[i])).toBe(true);
                }
                if (out.length > 8) expect(Number.isFinite(out[8])).toBe(true);
            }),
            { numRuns: 15 },
        );
    });
});
