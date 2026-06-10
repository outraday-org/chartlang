// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { ao } from "./ao.js";

const arbBar = fc
    .tuple(fc.double({ min: 50, max: 200, noNaN: true }), fc.integer({ min: 0, max: 60_000 }))
    .map(
        ([c, dt], _i): Bar => ({
            time: 1_700_000_000_000 + dt,
            open: c,
            high: c + 0.5,
            low: c - 0.5,
            close: c,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }),
    );

describe("ta.ao — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 35, maxLength: 60 }), (bars) => {
                const out = harness(bars, bars.length + 1, (_bar) => ao("slot").current);
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 20 },
        );
    });

    it("warmup is exactly `slowLength − 1` NaN slots", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 40, maxLength: 60 }),
                fc.integer({ min: 3, max: 8 }),
                fc.integer({ min: 9, max: 20 }),
                (bars, fastLength, slowLength) => {
                    const out = harness(
                        bars,
                        bars.length + 1,
                        (_bar) => ao("slot", { fastLength, slowLength }).current,
                    );
                    for (let i = 0; i < slowLength - 1 && i < out.length; i += 1) {
                        expect(Number.isNaN(out[i])).toBe(true);
                    }
                    if (out.length > slowLength - 1) {
                        expect(Number.isFinite(out[slowLength - 1])).toBe(true);
                    }
                },
            ),
            { numRuns: 20 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 35, maxLength: 60 }), (bars) => {
                const a = harness(bars, bars.length + 1, (_bar) => ao("slot").current);
                const b = harness(bars, bars.length + 1, (_bar) => ao("slot").current);
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                    else expect(b[i]).toBe(a[i]);
                }
            }),
            { numRuns: 15 },
        );
    });
});
