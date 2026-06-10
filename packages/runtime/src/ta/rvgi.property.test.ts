// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { rvgi } from "./rvgi.js";

const arbBar = fc
    .tuple(
        fc.double({ min: 10, max: 1000, noNaN: true }),
        fc.double({ min: 0.1, max: 5, noNaN: true }),
        fc.integer({ min: 0, max: 60_000 }),
    )
    .map(
        ([close, spread, dt]): Bar => ({
            time: 1_700_000_000_000 + dt,
            open: close - spread / 2,
            high: close + spread,
            low: close - spread,
            close,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }),
    );

describe("ta.rvgi — property invariants", () => {
    it("rvgi is finite or NaN for every emitted bar", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 30, maxLength: 80 }), (bars) => {
                const out = harness(bars, bars.length + 1, (bar) => rvgi("slot").rvgi.current);
                for (const v of out) {
                    if (!Number.isNaN(v)) expect(Number.isFinite(v)).toBe(true);
                }
            }),
            { numRuns: 15 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 30, maxLength: 60 }), (bars) => {
                const a = harness(bars, bars.length + 1, (bar) => {
                    const r = rvgi("slot");
                    return { rvgi: r.rvgi.current, signal: r.signal.current };
                });
                const b = harness(bars, bars.length + 1, (bar) => {
                    const r = rvgi("slot");
                    return { rvgi: r.rvgi.current, signal: r.signal.current };
                });
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i].rvgi)) expect(Number.isNaN(b[i].rvgi)).toBe(true);
                    else expect(b[i].rvgi).toBe(a[i].rvgi);
                    if (Number.isNaN(a[i].signal)) expect(Number.isNaN(b[i].signal)).toBe(true);
                    else expect(b[i].signal).toBe(a[i].signal);
                }
            }),
            { numRuns: 10 },
        );
    });
});
