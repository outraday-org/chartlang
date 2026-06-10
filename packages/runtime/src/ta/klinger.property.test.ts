// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { klinger } from "./klinger.js";

const arbBar = fc
    .tuple(
        fc.double({ min: 10, max: 1000, noNaN: true }),
        fc.double({ min: 0, max: 5, noNaN: true }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 60_000 }),
    )
    .map(
        ([close, spread, volume, dt]): Bar => ({
            time: 1_700_000_000_000 + dt,
            open: close,
            high: close + spread,
            low: close - spread,
            close,
            volume,
            symbol: "T",
            interval: "1m",
        }),
    );

describe("ta.klinger — property invariants", () => {
    it("klinger and signal are finite or NaN for every emitted bar", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 70, maxLength: 120 }), (bars) => {
                const out = harness(bars, bars.length + 1, (bar) => {
                    const k = klinger("slot");
                    return { klinger: k.klinger.current, signal: k.signal.current };
                });
                for (const { klinger: kv, signal: sv } of out) {
                    if (!Number.isNaN(kv)) expect(Number.isFinite(kv)).toBe(true);
                    if (!Number.isNaN(sv)) expect(Number.isFinite(sv)).toBe(true);
                }
            }),
            { numRuns: 10 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 30, maxLength: 60 }), (bars) => {
                const a = harness(bars, bars.length + 1, (bar) => klinger("slot").klinger.current);
                const b = harness(bars, bars.length + 1, (bar) => klinger("slot").klinger.current);
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                    else expect(b[i]).toBe(a[i]);
                }
            }),
            { numRuns: 10 },
        );
    });
});
