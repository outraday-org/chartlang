// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { kst } from "./kst.js";

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

describe("ta.kst — property invariants", () => {
    it("kst is finite or NaN for every emitted bar", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 60, maxLength: 100 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => kst("slot", bar.close).kst.current,
                );
                for (const v of out) {
                    if (!Number.isNaN(v)) expect(Number.isFinite(v)).toBe(true);
                }
            }),
            { numRuns: 15 },
        );
    });

    it("signal is finite or NaN for every emitted bar", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 60, maxLength: 100 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => kst("slot", bar.close).signal.current,
                );
                for (const v of out) {
                    if (!Number.isNaN(v)) expect(Number.isFinite(v)).toBe(true);
                }
            }),
            { numRuns: 15 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 40, maxLength: 80 }), (bars) => {
                const a = harness(bars, bars.length + 1, (bar) => {
                    const k = kst("slot", bar.close);
                    return { kst: k.kst.current, signal: k.signal.current };
                });
                const b = harness(bars, bars.length + 1, (bar) => {
                    const k = kst("slot", bar.close);
                    return { kst: k.kst.current, signal: k.signal.current };
                });
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i].kst)) expect(Number.isNaN(b[i].kst)).toBe(true);
                    else expect(b[i].kst).toBe(a[i].kst);
                    if (Number.isNaN(a[i].signal)) expect(Number.isNaN(b[i].signal)).toBe(true);
                    else expect(b[i].signal).toBe(a[i].signal);
                }
            }),
            { numRuns: 10 },
        );
    });
});
