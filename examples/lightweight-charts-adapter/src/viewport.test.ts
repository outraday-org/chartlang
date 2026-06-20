// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { priceToY, timeToX } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import {
    type BitmapScope,
    type LwcSeriesProjector,
    type LwcTimeScaleProjector,
    buildViewport,
} from "./viewport.js";

// A scope at 2× device-pixel ratio: media 400×200, bitmap 800×400.
const SCOPE_2X: BitmapScope = {
    bitmapSize: { width: 800, height: 400 },
    mediaSize: { width: 400, height: 200 },
    horizontalPixelRatio: 2,
    verticalPixelRatio: 2,
};

const SCOPE_1X: BitmapScope = {
    bitmapSize: { width: 400, height: 200 },
    mediaSize: { width: 400, height: 200 },
    horizontalPixelRatio: 1,
    verticalPixelRatio: 1,
};

// A linear LC stand-in: time `t` maps to media x via a slope+offset, price `p`
// maps to media y via a flipped slope+offset. `coordinateToPrice` inverts the
// price mapping. This is exactly the linear case option A is exact on.
function linearTimeScale(
    from: number,
    to: number,
    mediaXFrom: number,
    mediaXTo: number,
): LwcTimeScaleProjector {
    const slope = (mediaXTo - mediaXFrom) / (to - from);
    return {
        getVisibleRange: () => ({ from, to }),
        timeToCoordinate: (t) => mediaXFrom + slope * (t - from),
    };
}

// media y = a · price + b, inverted as price = (y − b) / a.
function linearSeries(a: number, b: number): LwcSeriesProjector {
    return {
        priceToCoordinate: (p) => a * p + b,
        coordinateToPrice: (y) => (y - b) / a,
    };
}

describe("buildViewport", () => {
    it("reproduces LC media coordinates in bitmap space (2× ratio)", () => {
        // Time: t∈[1000, 2000] → media x∈[50, 350]. Price: media y = −2·p + 600
        // (price 200 → y 200, price 250 → y 100), so the visible price band over
        // media y 0..200 is 300..200.
        const timeScale = linearTimeScale(1000, 2000, 50, 350);
        const series = linearSeries(-2, 600);
        const view = buildViewport(series, timeScale, SCOPE_2X);

        // A mid time/price must land on LC's coordinate × pixel ratio.
        const t = 1500;
        const mediaX = 50 + ((350 - 50) / (2000 - 1000)) * (t - 1000); // 200
        expect(timeToX(t, view)).toBeCloseTo(mediaX * SCOPE_2X.horizontalPixelRatio, 6);

        const p = 250;
        const mediaY = -2 * p + 600; // 100
        expect(priceToY(p, view)).toBeCloseTo(mediaY * SCOPE_2X.verticalPixelRatio, 6);
    });

    it("is exact at the visible extremes", () => {
        const timeScale = linearTimeScale(1000, 2000, 50, 350);
        const series = linearSeries(-2, 600);
        const view = buildViewport(series, timeScale, SCOPE_1X);

        expect(timeToX(1000, view)).toBeCloseTo(50, 6);
        expect(timeToX(2000, view)).toBeCloseTo(350, 6);
        // Pane top (media y 0) ↔ priceTop; pane bottom (media y 200) ↔ priceBottom.
        const priceTop = (0 - 600) / -2; // 300
        const priceBottom = (200 - 600) / -2; // 200
        expect(priceToY(priceTop, view)).toBeCloseTo(0, 6);
        expect(priceToY(priceBottom, view)).toBeCloseTo(200, 6);
    });

    it("falls back to an identity x window when there is no visible range", () => {
        const series = linearSeries(-2, 600);
        const view = buildViewport(
            series,
            { getVisibleRange: () => null, timeToCoordinate: () => null },
            SCOPE_1X,
        );
        // Identity x: xMin 0, xMax pxWidth — timeToX(n) === n.
        expect(view.xMin).toBe(0);
        expect(view.xMax).toBe(SCOPE_1X.bitmapSize.width);
        // Price still resolves from the series converter.
        expect(view.yMax).toBeCloseTo(300, 6);
    });

    it("falls back on a non-finite visible-range endpoint", () => {
        const series = linearSeries(-2, 600);
        const view = buildViewport(
            series,
            {
                getVisibleRange: () => ({ from: Number.NaN, to: 2000 }),
                timeToCoordinate: (t) => t,
            },
            SCOPE_1X,
        );
        expect(view.xMin).toBe(0);
        expect(view.xMax).toBe(SCOPE_1X.bitmapSize.width);
    });

    it("falls back on a non-numeric visible-range endpoint", () => {
        const series = linearSeries(-2, 600);
        const view = buildViewport(
            series,
            {
                // LC brands its horizontal scale item; a business-day object is
                // not the numeric timestamp the geometry needs.
                getVisibleRange: () => ({ from: { year: 2020 }, to: 2000 }),
                timeToCoordinate: (t) => t,
            },
            SCOPE_1X,
        );
        expect(view.xMin).toBe(0);
        expect(view.xMax).toBe(SCOPE_1X.bitmapSize.width);
    });

    it("falls back when timeToCoordinate returns null (off-screen)", () => {
        const series = linearSeries(-2, 600);
        const view = buildViewport(
            series,
            {
                getVisibleRange: () => ({ from: 1000, to: 2000 }),
                timeToCoordinate: () => null,
            },
            SCOPE_1X,
        );
        expect(view.xMin).toBe(0);
        expect(view.xMax).toBe(SCOPE_1X.bitmapSize.width);
    });

    it("falls back when the two time anchors collapse to one coordinate", () => {
        const series = linearSeries(-2, 600);
        const view = buildViewport(
            series,
            {
                getVisibleRange: () => ({ from: 1000, to: 2000 }),
                // Both extremes resolve to the same x → zero slope, no scale.
                timeToCoordinate: () => 100,
            },
            SCOPE_1X,
        );
        expect(view.xMin).toBe(0);
        expect(view.xMax).toBe(SCOPE_1X.bitmapSize.width);
    });

    it("keeps the identity y window when the price converters return null", () => {
        const timeScale = linearTimeScale(1000, 2000, 50, 350);
        const view = buildViewport(
            { priceToCoordinate: () => null, coordinateToPrice: () => null },
            timeScale,
            SCOPE_1X,
        );
        // x resolved from the time scale; y identity.
        expect(timeToX(1000, view)).toBeCloseTo(50, 6);
        expect(view.yMin).toBe(0);
        expect(view.yMax).toBe(SCOPE_1X.bitmapSize.height);
    });

    it("keeps the identity y window for a degenerate (flat) price range", () => {
        const timeScale = linearTimeScale(1000, 2000, 50, 350);
        const view = buildViewport(
            { priceToCoordinate: () => 0, coordinateToPrice: () => 105 },
            timeScale,
            SCOPE_1X,
        );
        expect(view.yMin).toBe(0);
        expect(view.yMax).toBe(SCOPE_1X.bitmapSize.height);
    });
});
