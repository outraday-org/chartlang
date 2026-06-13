// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { computePaneLayout } from "./paneLayout.js";

const CANVAS = { width: 800, height: 400 };

describe("computePaneLayout", () => {
    it("zero subpanes — single overlay entry filling the full canvas", () => {
        const layout = computePaneLayout(["overlay"], CANVAS);
        expect(layout).toHaveLength(1);
        expect(layout[0]).toEqual({
            paneKey: "overlay",
            rect: { x: 0, y: 0, w: 800, h: 400 },
        });
    });

    it("one subpane — overlay 80% (320), subpane 20% (80) at y=320", () => {
        const layout = computePaneLayout(["overlay", "rsi"], CANVAS);
        expect(layout).toHaveLength(2);
        expect(layout[0].rect).toEqual({ x: 0, y: 0, w: 800, h: 320 });
        expect(layout[1]).toEqual({
            paneKey: "rsi",
            rect: { x: 0, y: 320, w: 800, h: 80 },
        });
        const total = layout.reduce((sum, e) => sum + e.rect.h, 0);
        expect(total).toBe(CANVAS.height);
    });

    it("three subpanes — last absorbs the rounding remainder; heights sum to canvas height", () => {
        const layout = computePaneLayout(["overlay", "a", "b", "c"], CANVAS);
        expect(layout).toHaveLength(4);
        expect(layout[0].rect.h).toBe(320);
        // 80 band / 3 = 26 each; remainder 2 lands on the last (28).
        expect(layout[1].rect.h).toBe(26);
        expect(layout[2].rect.h).toBe(26);
        expect(layout[3].rect.h).toBe(28);
        const total = layout.reduce((sum, e) => sum + e.rect.h, 0);
        expect(total).toBe(CANVAS.height);
    });

    it("five subpanes — remainder lands on the last subpane; heights sum to canvas height", () => {
        const layout = computePaneLayout(["overlay", "a", "b", "c", "d", "e"], CANVAS);
        expect(layout).toHaveLength(6);
        expect(layout[0].rect.h).toBe(320);
        // 80 band / 5 = 16 each; no remainder.
        const subpaneHeights = layout.slice(1).map((e) => e.rect.h);
        expect(subpaneHeights).toEqual([16, 16, 16, 16, 16]);
        const total = layout.reduce((sum, e) => sum + e.rect.h, 0);
        expect(total).toBe(CANVAS.height);
    });

    it("remainder genuinely lands on the last subpane for a non-divisible band", () => {
        // 20% of 401 = 80.2 -> priceHeight floor(320.8)=320, band=81, /4=20, last=21.
        const layout = computePaneLayout(["overlay", "a", "b", "c", "d"], {
            width: 800,
            height: 401,
        });
        expect(layout[0].rect.h).toBe(320);
        const subpaneHeights = layout.slice(1).map((e) => e.rect.h);
        expect(subpaneHeights).toEqual([20, 20, 20, 21]);
        const total = layout.reduce((sum, e) => sum + e.rect.h, 0);
        expect(total).toBe(401);
    });

    it('no "overlay" in input — overlay entry still emitted at index 0 with the price-pane rect', () => {
        const layout = computePaneLayout(["rsi"], CANVAS);
        expect(layout).toHaveLength(2);
        expect(layout[0]).toEqual({
            paneKey: "overlay",
            rect: { x: 0, y: 0, w: 800, h: 320 },
        });
        expect(layout[1].paneKey).toBe("rsi");
    });

    it("output array is frozen", () => {
        expect(Object.isFrozen(computePaneLayout(["overlay"], CANVAS))).toBe(true);
        expect(Object.isFrozen(computePaneLayout(["overlay", "rsi"], CANVAS))).toBe(true);
    });

    it("preserves paneOrder input order among subpanes", () => {
        const layout = computePaneLayout(["overlay", "c", "a", "b"], CANVAS);
        expect(layout.slice(1).map((e) => e.paneKey)).toEqual(["c", "a", "b"]);
    });
});
