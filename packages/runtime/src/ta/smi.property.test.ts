// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { smi } from "./smi.js";

const arbBar = fc
    .tuple(
        fc.double({ min: 10, max: 1000, noNaN: true }),
        fc.double({ min: 0.1, max: 5, noNaN: true }),
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

describe("ta.smi — property invariants", () => {
    it("smi ∈ [-100, 100] (or NaN) for every emitted bar", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 40, maxLength: 100 }), (bars) => {
                const out = harness(bars, bars.length + 1, (bar) => smi("slot").smi.current);
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
            fc.property(fc.array(arbBar, { minLength: 40, maxLength: 100 }), (bars) => {
                const out = harness(bars, bars.length + 1, (bar) => smi("slot").signal.current);
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
            fc.property(fc.array(arbBar, { minLength: 30, maxLength: 60 }), (bars) => {
                const a = harness(bars, bars.length + 1, (bar) => smi("slot").smi.current);
                const b = harness(bars, bars.length + 1, (bar) => smi("slot").smi.current);
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                    else expect(b[i]).toBe(a[i]);
                }
            }),
            { numRuns: 10 },
        );
    });
});
