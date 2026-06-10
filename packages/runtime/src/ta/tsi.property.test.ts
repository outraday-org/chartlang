// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { tsi } from "./tsi.js";

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

describe("ta.tsi — property invariants", () => {
    it("tsi ∈ [-100, 100] (or NaN) for every emitted bar", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 60, maxLength: 100 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => tsi("slot", bar.close).tsi.current,
                );
                const EPSILON = 1e-9;
                for (const v of out) {
                    if (Number.isFinite(v)) {
                        expect(v).toBeGreaterThanOrEqual(-100 - EPSILON);
                        expect(v).toBeLessThanOrEqual(100 + EPSILON);
                    }
                }
            }),
            { numRuns: 15 },
        );
    });

    it("signal ∈ [-100, 100] (or NaN) for every emitted bar", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 60, maxLength: 100 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => tsi("slot", bar.close).signal.current,
                );
                const EPSILON = 1e-9;
                for (const v of out) {
                    if (Number.isFinite(v)) {
                        expect(v).toBeGreaterThanOrEqual(-100 - EPSILON);
                        expect(v).toBeLessThanOrEqual(100 + EPSILON);
                    }
                }
            }),
            { numRuns: 15 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 50, maxLength: 80 }), (bars) => {
                const a = harness(
                    bars,
                    bars.length + 1,
                    (bar) => tsi("slot", bar.close).tsi.current,
                );
                const b = harness(
                    bars,
                    bars.length + 1,
                    (bar) => tsi("slot", bar.close).tsi.current,
                );
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                    else expect(b[i]).toBe(a[i]);
                }
            }),
            { numRuns: 10 },
        );
    });
});
