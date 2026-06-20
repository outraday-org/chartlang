// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { computePaneLayout } from "./paneLayout.js";

describe("computePaneLayout", () => {
    it("gives the overlay pane the full stage with zero subpanes", () => {
        const layout = computePaneLayout(["overlay"], { width: 800, height: 400 });
        expect(layout).toEqual([{ paneKey: "overlay", rect: { x: 0, y: 0, w: 800, h: 400 } }]);
        expect(Object.isFrozen(layout)).toBe(true);
    });

    it("splits 80% overlay / 20% subpane band", () => {
        const layout = computePaneLayout(["overlay", "rsi"], { width: 800, height: 400 });
        expect(layout[0].rect.h).toBe(320);
        expect(layout[1].rect).toEqual({ x: 0, y: 320, w: 800, h: 80 });
    });

    it("shares the band across N subpanes, last absorbing the remainder", () => {
        const layout = computePaneLayout(["overlay", "a", "b", "c"], { width: 100, height: 101 });
        const overlay = layout[0].rect;
        const subs = layout.slice(1).map((e) => e.rect.h);
        // overlay = floor(101 * 0.8) = 80; band = 21; uniform = floor(21/3) = 7;
        // last absorbs remainder so 7 + 7 + (21 - 14) = 21 total.
        expect(overlay.h).toBe(80);
        expect(subs).toEqual([7, 7, 7]);
        expect(subs.reduce((a, b) => a + b, 0)).toBe(101 - 80);
    });

    it("fills the stage exactly when the band does not divide evenly", () => {
        const layout = computePaneLayout(["overlay", "a", "b"], { width: 100, height: 100 });
        const total = layout.reduce((sum, e) => sum + e.rect.h, 0);
        expect(total).toBe(100);
    });
});
