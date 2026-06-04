// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers";
import { harness } from "./__fixtures__/runPrimitive";
import { macd } from "./macd";

describe("ta.macd — property invariants", () => {
    it("hist = macd − signal where both are finite", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 60, maxLength: 120 }), (bars) => {
                const out = harness(bars, bars.length + 1, (bar) => {
                    const r = macd("slot", bar.close, {
                        fastLength: 5,
                        slowLength: 13,
                        signalLength: 3,
                    });
                    return { m: r.macd.current, s: r.signal.current, h: r.hist.current };
                });
                for (const { m, s, h } of out) {
                    if (Number.isFinite(m) && Number.isFinite(s)) {
                        expect(h).toBeCloseTo(m - s, 8);
                    }
                }
            }),
            { numRuns: 15 },
        );
    });

    it("returns the same record identity across bars", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 40 }), (bars) => {
                const refs: unknown[] = [];
                harness(bars, bars.length + 1, (bar) => {
                    refs.push(macd("slot", bar.close));
                    return null;
                });
                for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
            }),
            { numRuns: 10 },
        );
    });
});
