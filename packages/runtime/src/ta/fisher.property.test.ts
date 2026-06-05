// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { fisher } from "./fisher";

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

describe("ta.fisher — property invariants", () => {
    it("fisher is finite or NaN for every emitted bar", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 20, maxLength: 80 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => fisher("slot", 9).fisher.current,
                );
                for (const v of out) {
                    if (!Number.isNaN(v)) expect(Number.isFinite(v)).toBe(true);
                }
            }),
            { numRuns: 20 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 30, maxLength: 60 }), (bars) => {
                const a = harness(bars, bars.length + 1, (bar) => {
                    const f = fisher("slot", 9);
                    return { fisher: f.fisher.current, trigger: f.trigger.current };
                });
                const b = harness(bars, bars.length + 1, (bar) => {
                    const f = fisher("slot", 9);
                    return { fisher: f.fisher.current, trigger: f.trigger.current };
                });
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i].fisher)) {
                        expect(Number.isNaN(b[i].fisher)).toBe(true);
                    } else {
                        expect(b[i].fisher).toBe(a[i].fisher);
                    }
                    if (Number.isNaN(a[i].trigger)) {
                        expect(Number.isNaN(b[i].trigger)).toBe(true);
                    } else {
                        expect(b[i].trigger).toBe(a[i].trigger);
                    }
                }
            }),
            { numRuns: 15 },
        );
    });
});
