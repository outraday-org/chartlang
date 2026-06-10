// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { dpo } from "./dpo.js";

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

describe("ta.dpo — property invariants", () => {
    it("output length advances by 1 per close", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => dpo("slot", bar.close, 10).current,
                );
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 20 },
        );
    });

    it("warmup is `length` NaN slots", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 30, maxLength: 60 }), (bars) => {
                const length = 10;
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => dpo("slot", bar.close, length).current,
                );
                // First defined output at bar `length - 1 = 9` (sma seeds).
                for (let i = 0; i < length - 1 && i < out.length; i += 1) {
                    expect(Number.isNaN(out[i])).toBe(true);
                }
            }),
            { numRuns: 15 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 20, maxLength: 50 }), (bars) => {
                const a = harness(
                    bars,
                    bars.length + 1,
                    (bar) => dpo("slot", bar.close, 21).current,
                );
                const b = harness(
                    bars,
                    bars.length + 1,
                    (bar) => dpo("slot", bar.close, 21).current,
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
