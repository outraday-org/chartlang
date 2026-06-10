// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { makeNanSecurityBar } from "./security.js";

describe("makeNanSecurityBar", () => {
    it("returns a frozen SecurityBar with NaN numeric series", () => {
        const bar = makeNanSecurityBar();

        expect(Object.isFrozen(bar)).toBe(true);
        for (const series of [
            bar.time,
            bar.open,
            bar.high,
            bar.low,
            bar.close,
            bar.volume,
            bar.hl2,
            bar.hlc3,
            bar.ohlc4,
            bar.hlcc4,
        ]) {
            expect(Object.isFrozen(series)).toBe(true);
            expect(Number.isNaN(series.current)).toBe(true);
            expect(series.length).toBe(0);
            expect(series[1]).toBeUndefined();
        }
    });

    it("returns frozen empty-string metadata series", () => {
        const bar = makeNanSecurityBar();

        for (const series of [bar.symbol, bar.interval]) {
            expect(Object.isFrozen(series)).toBe(true);
            expect(series.current).toBe("");
            expect(series.length).toBe(0);
            expect(series[1]).toBeUndefined();
        }
    });
});
