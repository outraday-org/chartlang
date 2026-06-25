// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { computeBarWidthPx } from "./bar-width-formula.js";

describe("computeBarWidthPx — TradingView optimal-bar-width port", () => {
    it("returns 1 for non-finite or non-positive pitch", () => {
        expect(computeBarWidthPx(Number.NaN)).toBe(1);
        expect(computeBarWidthPx(Number.POSITIVE_INFINITY)).toBe(1);
        expect(computeBarWidthPx(0)).toBe(1);
        expect(computeBarWidthPx(-5)).toBe(1);
    });

    it("dense bars (< 2.5 px) ceil to the pitch — no overlap, no gap", () => {
        expect(computeBarWidthPx(1)).toBe(1);
        expect(computeBarWidthPx(1.2)).toBe(2);
        expect(computeBarWidthPx(2.4)).toBe(3);
    });

    it("wide pitch (≥ 4 px) trends to floor(pitch * 0.8) − wickClearance", () => {
        // 10 * 0.8 = 8, − 1 wick clearance = 7.
        expect(computeBarWidthPx(10, { wickClearancePx: 1 })).toBe(7);
        // No wick clearance (volume bars) keeps the full 0.8 ratio.
        expect(computeBarWidthPx(10, { wickClearancePx: 0 })).toBe(8);
    });

    it("never exceeds maxWidthPx and never drops below 1", () => {
        expect(computeBarWidthPx(50, { maxWidthPx: 6 })).toBe(6);
        expect(computeBarWidthPx(1000, { maxWidthPx: 6, wickClearancePx: 1 })).toBe(6);
        // A tight pitch still yields a visible 1-px bar even with clearance.
        expect(computeBarWidthPx(2.6, { wickClearancePx: 1 })).toBeGreaterThanOrEqual(1);
    });

    it("always returns an integer", () => {
        for (const pitch of [1.3, 2.7, 3.5, 7.9, 12.1]) {
            expect(Number.isInteger(computeBarWidthPx(pitch))).toBe(true);
        }
    });

    it("the transition zone (2.5 ≤ pitch < 4) is monotonic and bounded by the neighbours", () => {
        const low = computeBarWidthPx(2.5, { wickClearancePx: 1 });
        const high = computeBarWidthPx(3.99, { wickClearancePx: 1 });
        expect(high).toBeGreaterThanOrEqual(low);
        expect(low).toBeGreaterThanOrEqual(1);
    });
});
