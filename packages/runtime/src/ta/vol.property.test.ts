// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { vol } from "./vol.js";

const arbBar = fc
    .tuple(
        fc.double({ min: 1, max: 1000, noNaN: true }),
        fc.integer({ min: 0, max: 100_000 }),
        fc.integer({ min: 0, max: 60_000 }),
    )
    .map(
        ([c, v, dt], _i): Bar => ({
            time: 1_700_000_000_000 + dt,
            open: c,
            high: c,
            low: c,
            close: c,
            volume: v,
            symbol: "T",
            interval: "1m",
        }),
    );

describe("ta.vol — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 60 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => vol("slot").current);
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 30 },
        );
    });

    it("output value equals input bar.volume verbatim", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 60 }), (bars) => {
                const out = harness(bars, bars.length + 1, (bar) => vol("slot", bar).current);
                for (let i = 0; i < bars.length; i += 1) {
                    expect(out[i]).toBe(bars[i].volume);
                }
            }),
            { numRuns: 30 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 1, maxLength: 60 }), (bars) => {
                const a = harness(bars, bars.length + 1, () => vol("slot").current);
                const b = harness(bars, bars.length + 1, () => vol("slot").current);
                for (let i = 0; i < a.length; i += 1) expect(b[i]).toBe(a[i]);
            }),
            { numRuns: 20 },
        );
    });
});
