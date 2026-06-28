// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import {
    PRICE_AXIS_GUTTER_PX,
    PRICE_PANE_FRACTION,
    TIME_AXIS_GUTTER_PX,
    computePaneLayout,
} from "./layout.js";

// Every pane is inset by the axis gutters: plotWidth = cssWidth − 52,
// plotHeight = cssHeight − 18 (the reserved price / time label bands).
describe("computePaneLayout — single overlay pane", () => {
    it("insets the canvas by the axis gutters when there are no subpanes", () => {
        const rects = computePaneLayout(["overlay"], 800, 400);
        // 800 − 52 = 748, 400 − 18 = 382.
        expect(rects).toEqual([{ paneKey: "overlay", x: 0, y: 0, width: 748, height: 382 }]);
    });

    it("ignores an empty pane order as the overlay-only case", () => {
        const rects = computePaneLayout([], 640, 480);
        // 640 − 52 = 588, 480 − 18 = 462.
        expect(rects).toEqual([{ paneKey: "overlay", x: 0, y: 0, width: 588, height: 462 }]);
    });
});

describe("computePaneLayout — stacked subpanes", () => {
    it("gives the overlay the top 80% and the subpane the bottom 20% of the plot area", () => {
        const rects = computePaneLayout(["overlay", "rsi"], 800, 400);
        // plot 748×382; priceHeight = floor(382·0.8) = 305; rsi = 382 − 305 = 77.
        expect(rects).toEqual([
            { paneKey: "overlay", x: 0, y: 0, width: 748, height: 305 },
            { paneKey: "rsi", x: 0, y: 305, width: 748, height: 77 },
        ]);
    });

    it("splits the bottom band uniformly across multiple subpanes", () => {
        const rects = computePaneLayout(["overlay", "volume", "macd"], 800, 400);
        // plotHeight = 382; priceHeight = 305; band = 77; each = floor(38.5) = 38;
        // last absorbs the remainder (382 − 343 = 39).
        expect(rects[0]).toEqual({ paneKey: "overlay", x: 0, y: 0, width: 748, height: 305 });
        expect(rects[1]).toEqual({ paneKey: "volume", x: 0, y: 305, width: 748, height: 38 });
        expect(rects[2]).toEqual({ paneKey: "macd", x: 0, y: 343, width: 748, height: 39 });
    });

    it("the last subpane absorbs the integer-rounding remainder (tiles the plot exactly)", () => {
        // 401 height → plotHeight = 383; priceHeight = floor(383·0.8) = 306;
        // band = 77; each floors to 38, the last takes 383 − 344 = 39, so the
        // panes tile to plotHeight (383) with no seam.
        const rects = computePaneLayout(["overlay", "a", "b"], 800, 401);
        expect(rects[0].height).toBe(306);
        expect(rects[1]).toEqual({ paneKey: "a", x: 0, y: 306, width: 748, height: 38 });
        expect(rects[2]).toEqual({ paneKey: "b", x: 0, y: 344, width: 748, height: 39 });
        const total = rects.reduce((sum, r) => sum + r.height, 0);
        expect(total).toBe(383);
    });

    it("exposes the axis-gutter constants", () => {
        expect(PRICE_AXIS_GUTTER_PX).toBe(52);
        expect(TIME_AXIS_GUTTER_PX).toBe(18);
    });

    it("preserves paneOrder for the subpane stacking order", () => {
        const rects = computePaneLayout(["overlay", "macd", "rsi", "volume"], 1000, 500);
        expect(rects.map((r) => r.paneKey)).toEqual(["overlay", "macd", "rsi", "volume"]);
    });

    it("exposes the canvas2d-matching price-pane fraction", () => {
        expect(PRICE_PANE_FRACTION).toBe(0.8);
    });
});
