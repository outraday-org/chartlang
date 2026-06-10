// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/intercept.test.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import { describe, expect, it } from "vitest";

import { findInterceptIndex } from "./intercept.js";

function c(low: number, high: number): { low: number; high: number } {
    return { high, low };
}

describe("findInterceptIndex", () => {
    it("returns the first future candle containing price", () => {
        const bars = [c(100, 110), c(101, 109), c(102, 108), c(103, 107)];
        expect(findInterceptIndex(bars, 0, 104)).toBe(1);
    });

    it("starts searching after fromIdx", () => {
        const bars = [c(100, 110), c(101, 109), c(102, 108), c(103, 107)];
        expect(findInterceptIndex(bars, 2, 104)).toBe(3);
    });

    it("returns right edge when no candle intercepts or price is NaN", () => {
        const bars = [c(100, 110), c(101, 109), c(102, 108)];
        expect(findInterceptIndex(bars, 0, 200)).toBe(2);
        expect(findInterceptIndex(bars, 0, Number.NaN)).toBe(2);
    });

    it("handles empty arrays and negative fromIdx", () => {
        expect(findInterceptIndex([], 0, 100)).toBe(-1);
        expect(findInterceptIndex([c(100, 110)], -10, 105)).toBe(0);
    });
});
