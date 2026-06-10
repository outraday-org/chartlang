// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { coppock } from "./coppock.js";

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

describe("ta.coppock — property invariants", () => {
    it("output length advances by 1 per close", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => coppock("slot", bar.close).current,
                );
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 20 },
        );
    });

    it("warmup is at least max(roc1, roc2) + wmaLength − 1 NaN slots", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 30, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) =>
                        coppock("slot", bar.close, {
                            roc1Length: 3,
                            roc2Length: 5,
                            wmaLength: 4,
                        }).current,
                );
                // First defined output at bar `max(3, 5) + 4 - 1 = 8`.
                for (let i = 0; i < 8 && i < out.length; i += 1) {
                    expect(Number.isNaN(out[i])).toBe(true);
                }
            }),
            { numRuns: 15 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 30, maxLength: 60 }), (bars) => {
                const a = harness(
                    bars,
                    bars.length + 1,
                    (bar) => coppock("slot", bar.close).current,
                );
                const b = harness(
                    bars,
                    bars.length + 1,
                    (bar) => coppock("slot", bar.close).current,
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
