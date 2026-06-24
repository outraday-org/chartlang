// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { resolveCandleOverrideColor } from "./candleOverrides.js";

function bar(open: number, close: number): Bar {
    return {
        time: 0,
        open,
        high: Math.max(open, close) + 1,
        low: Math.min(open, close) - 1,
        close,
        volume: 1,
        symbol: "DEMO",
        interval: "1D",
        hl2: 0,
        hlc3: 0,
        ohlc4: 0,
        hlcc4: 0,
    };
}

describe("resolveCandleOverrideColor", () => {
    const palette = { bull: "#0f0", bear: "#f00", doji: "#00f" } as const;

    it("returns the bull colour for a bar that closes above its open", () => {
        expect(resolveCandleOverrideColor(bar(100, 105), palette)).toBe("#0f0");
    });

    it("returns the bear colour for a bar that closes below its open", () => {
        expect(resolveCandleOverrideColor(bar(105, 100), palette)).toBe("#f00");
    });

    it("returns the doji colour for an unchanged bar when one is set", () => {
        expect(resolveCandleOverrideColor(bar(100, 100), palette)).toBe("#00f");
    });

    it("falls back to the bull colour for a doji when no doji colour is set", () => {
        expect(resolveCandleOverrideColor(bar(100, 100), { bull: "#0f0", bear: "#f00" })).toBe(
            "#0f0",
        );
    });
});
