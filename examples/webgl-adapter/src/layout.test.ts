// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { PRICE_PANE_FRACTION, computePaneLayout } from "./layout.js";

describe("computePaneLayout — single overlay pane", () => {
    it("spans the full canvas when there are no subpanes", () => {
        const rects = computePaneLayout(["overlay"], 800, 400);
        expect(rects).toEqual([{ paneKey: "overlay", x: 0, y: 0, width: 800, height: 400 }]);
    });

    it("ignores an empty pane order as the overlay-only case", () => {
        const rects = computePaneLayout([], 640, 480);
        expect(rects).toEqual([{ paneKey: "overlay", x: 0, y: 0, width: 640, height: 480 }]);
    });
});

describe("computePaneLayout — stacked subpanes", () => {
    it("gives the overlay the top 80% and the subpane the bottom 20%", () => {
        const rects = computePaneLayout(["overlay", "rsi"], 800, 400);
        expect(rects).toEqual([
            { paneKey: "overlay", x: 0, y: 0, width: 800, height: 320 },
            { paneKey: "rsi", x: 0, y: 320, width: 800, height: 80 },
        ]);
    });

    it("splits the bottom band uniformly across multiple subpanes", () => {
        const rects = computePaneLayout(["overlay", "volume", "macd"], 800, 400);
        // priceHeight = floor(400 * 0.8) = 320; band = 80; each = floor(40).
        expect(rects[0]).toEqual({ paneKey: "overlay", x: 0, y: 0, width: 800, height: 320 });
        expect(rects[1]).toEqual({ paneKey: "volume", x: 0, y: 320, width: 800, height: 40 });
        expect(rects[2]).toEqual({ paneKey: "macd", x: 0, y: 360, width: 800, height: 40 });
    });

    it("the last subpane absorbs the integer-rounding remainder (tiles exactly)", () => {
        // 401 height: priceHeight = floor(401*0.8) = 320; band = 81; with 2
        // subpanes each floors to 40, the last takes 81 - 40 = 41 so the panes
        // tile to 401 with no seam.
        const rects = computePaneLayout(["overlay", "a", "b"], 800, 401);
        expect(rects[0].height).toBe(320);
        expect(rects[1]).toEqual({ paneKey: "a", x: 0, y: 320, width: 800, height: 40 });
        expect(rects[2]).toEqual({ paneKey: "b", x: 0, y: 360, width: 800, height: 41 });
        const total = rects.reduce((sum, r) => sum + r.height, 0);
        expect(total).toBe(401);
    });

    it("preserves paneOrder for the subpane stacking order", () => {
        const rects = computePaneLayout(["overlay", "macd", "rsi", "volume"], 1000, 500);
        expect(rects.map((r) => r.paneKey)).toEqual(["overlay", "macd", "rsi", "volume"]);
    });

    it("exposes the canvas2d-matching price-pane fraction", () => {
        expect(PRICE_PANE_FRACTION).toBe(0.8);
    });
});
