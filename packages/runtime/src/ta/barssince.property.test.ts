// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Series } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { barssince } from "./barssince.js";

function boolSeries(value: boolean): Series<boolean> {
    return { current: value, length: 1 } as unknown as Series<boolean>;
}

describe("ta.barssince — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(fc.boolean(), { minLength: 5, maxLength: 30 }), (pattern) => {
                const bars = syntheticBars(pattern.length, 1);
                const out = harness(
                    bars,
                    bars.length + 1,
                    (_bar, ctx) => barssince("slot", boolSeries(pattern[ctx.barIndex()])).current,
                );
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 30 },
        );
    });

    it("emits NaN for every bar before the first true", () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 20 }), (n) => {
                const bars = syntheticBars(n, 2);
                const out = harness(
                    bars,
                    bars.length + 1,
                    () => barssince("slot", boolSeries(false)).current,
                );
                for (const v of out) expect(Number.isNaN(v)).toBe(true);
            }),
            { numRuns: 30 },
        );
    });

    it("counts since true monotonically until the next true", () => {
        fc.assert(
            fc.property(fc.array(fc.boolean(), { minLength: 10, maxLength: 30 }), (pattern) => {
                const bars = syntheticBars(pattern.length, 3);
                const out = harness(
                    bars,
                    bars.length + 1,
                    (_bar, ctx) => barssince("slot", boolSeries(pattern[ctx.barIndex()])).current,
                );
                let expected = Number.NaN;
                let seen = false;
                for (let i = 0; i < pattern.length; i += 1) {
                    if (pattern[i]) {
                        expected = 0;
                        seen = true;
                    } else if (seen) {
                        expected = (expected as number) + 1;
                    }
                    if (Number.isNaN(expected)) expect(Number.isNaN(out[i])).toBe(true);
                    else expect(out[i]).toBe(expected);
                }
            }),
            { numRuns: 30 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(fc.boolean(), { minLength: 5, maxLength: 30 }), (pattern) => {
                const bars = syntheticBars(pattern.length, 4);
                const run = () =>
                    harness(
                        bars,
                        bars.length + 1,
                        (_bar, ctx) =>
                            barssince("slot", boolSeries(pattern[ctx.barIndex()])).current,
                    );
                const a = run();
                const b = run();
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                    else expect(b[i]).toBe(a[i]);
                }
            }),
            { numRuns: 20 },
        );
    });
});
