// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers.js";
import { harness } from "./__fixtures__/runPrimitive.js";
import { ichimoku } from "./ichimoku.js";
import { donchianMid } from "./lib/donchianMid.js";

function referenceIchimoku(
    bars: ReadonlyArray<Bar>,
    conversionLength: number,
    baseLength: number,
    leadingSpanBLength: number,
    displacement: number,
): {
    tenkan: Float64Array;
    kijun: Float64Array;
    senkouA: Float64Array;
    senkouB: Float64Array;
    chikou: Float64Array;
} {
    const n = bars.length;
    const high = new Float64Array(n);
    const low = new Float64Array(n);
    for (let i = 0; i < n; i += 1) {
        high[i] = bars[i].high;
        low[i] = bars[i].low;
    }
    const tenkan = donchianMid(high, low, conversionLength);
    const kijun = donchianMid(high, low, baseLength);
    const senkouBRaw = donchianMid(high, low, leadingSpanBLength);
    const senkouA = new Float64Array(n);
    const senkouB = new Float64Array(n);
    const chikou = new Float64Array(n);
    senkouA.fill(Number.NaN);
    senkouB.fill(Number.NaN);
    chikou.fill(Number.NaN);
    for (let i = 0; i < n; i += 1) {
        const src = i - displacement;
        if (src >= 0) {
            const t = tenkan[src];
            const k = kijun[src];
            if (Number.isFinite(t) && Number.isFinite(k)) senkouA[i] = (t + k) / 2;
            senkouB[i] = senkouBRaw[src];
            chikou[i] = bars[src].close;
        }
    }
    return { tenkan, kijun, senkouA, senkouB, chikou };
}

describe("ta.ichimoku — property invariants", () => {
    it("output lengths equal input length for all five series", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 30 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => {
                    const i = ichimoku("slot", {
                        conversionLength: 3,
                        baseLength: 5,
                        leadingSpanBLength: 7,
                        displacement: 2,
                    });
                    return {
                        tenkan: i.tenkan.current,
                        kijun: i.kijun.current,
                        senkouA: i.senkouA.current,
                        senkouB: i.senkouB.current,
                        chikou: i.chikou.current,
                    };
                });
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 20 },
        );
    });

    it("incremental output matches the donchianMid + displacement reference", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 30, maxLength: 80 }), (bars) => {
                const conversionLength = 3;
                const baseLength = 5;
                const leadingSpanBLength = 7;
                const displacement = 4;
                const expected = referenceIchimoku(
                    bars,
                    conversionLength,
                    baseLength,
                    leadingSpanBLength,
                    displacement,
                );
                const actual = harness(bars, bars.length + 1, () => {
                    const i = ichimoku("slot", {
                        conversionLength,
                        baseLength,
                        leadingSpanBLength,
                        displacement,
                    });
                    return {
                        tenkan: i.tenkan.current,
                        kijun: i.kijun.current,
                        senkouA: i.senkouA.current,
                        senkouB: i.senkouB.current,
                        chikou: i.chikou.current,
                    };
                });
                for (let i = 0; i < bars.length; i += 1) {
                    const keys = ["tenkan", "kijun", "senkouA", "senkouB", "chikou"] as const;
                    for (const key of keys) {
                        const e = expected[key][i];
                        const a = actual[i][key];
                        if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
                        else expect(a).toBeCloseTo(e, 8);
                    }
                }
            }),
            { numRuns: 15 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 10, maxLength: 40 }), (bars) => {
                const a = harness(bars, bars.length + 1, () => {
                    const i = ichimoku("slot", {
                        conversionLength: 3,
                        baseLength: 5,
                        leadingSpanBLength: 7,
                        displacement: 3,
                    });
                    return { tenkan: i.tenkan.current, kijun: i.kijun.current };
                });
                const b = harness(bars, bars.length + 1, () => {
                    const i = ichimoku("slot", {
                        conversionLength: 3,
                        baseLength: 5,
                        leadingSpanBLength: 7,
                        displacement: 3,
                    });
                    return { tenkan: i.tenkan.current, kijun: i.kijun.current };
                });
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i].tenkan)) expect(Number.isNaN(b[i].tenkan)).toBe(true);
                    else expect(b[i].tenkan).toBe(a[i].tenkan);
                    if (Number.isNaN(a[i].kijun)) expect(Number.isNaN(b[i].kijun)).toBe(true);
                    else expect(b[i].kijun).toBe(a[i].kijun);
                }
            }),
            { numRuns: 15 },
        );
    });

    it("returns the same record identity across all bars", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 30 }), (bars) => {
                const refs: unknown[] = [];
                harness(bars, bars.length + 1, () => {
                    refs.push(ichimoku("slot"));
                    return null;
                });
                for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
            }),
            { numRuns: 15 },
        );
    });
});
