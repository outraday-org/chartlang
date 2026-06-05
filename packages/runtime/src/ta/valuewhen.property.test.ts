// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar, Series } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { valuewhen } from "./valuewhen";

const arbBar = fc
    .tuple(fc.double({ min: 1, max: 1000, noNaN: true }), fc.integer({ min: 0, max: 60_000 }))
    .map(
        ([c, dt], _i): Bar => ({
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

function boolSeries(value: boolean): Series<boolean> {
    return { current: value, length: 1 } as unknown as Series<boolean>;
}

describe("ta.valuewhen — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(
                fc.tuple(
                    fc.array(arbBar, { minLength: 5, maxLength: 30 }),
                    fc.array(fc.boolean(), { minLength: 5, maxLength: 30 }),
                ),
                ([bars, conds]) => {
                    const n = Math.min(bars.length, conds.length);
                    const trimmed = bars.slice(0, n);
                    const out = harness(
                        trimmed,
                        trimmed.length + 1,
                        (bar, ctx) =>
                            valuewhen("slot", boolSeries(conds[ctx.barIndex()]), bar.close, 0)
                                .current,
                    );
                    expect(out.length).toBe(trimmed.length);
                },
            ),
            { numRuns: 30 },
        );
    });

    it("emits NaN for every bar before the first match", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 30 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => valuewhen("slot", boolSeries(false), bar.close, 0).current,
                );
                for (const v of out) {
                    expect(Number.isNaN(v)).toBe(true);
                }
            }),
            { numRuns: 30 },
        );
    });

    it("after first match, emits the source value verbatim under a constantly-firing condition", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 2, maxLength: 30 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => valuewhen("slot", boolSeries(true), bar.close, 0).current,
                );
                for (let i = 0; i < bars.length; i += 1) {
                    expect(out[i]).toBe(bars[i].close);
                }
            }),
            { numRuns: 30 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 30 }), (bars) => {
                const run = () =>
                    harness(
                        bars,
                        bars.length + 1,
                        (bar, ctx) =>
                            valuewhen("slot", boolSeries(ctx.barIndex() % 3 === 0), bar.close, 0)
                                .current,
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
