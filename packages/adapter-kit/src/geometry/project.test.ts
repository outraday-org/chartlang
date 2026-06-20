// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { priceToY, timeToX, worldPointToPixel } from "./project.js";
import type { Viewport } from "./types.js";

const view: Viewport = { xMin: 0, xMax: 10, yMin: 100, yMax: 110, pxWidth: 100, pxHeight: 100 };

describe("timeToX", () => {
    it("maps time linearly into the viewport width", () => {
        expect(timeToX(5, view)).toBe(50);
        expect(timeToX(0, view)).toBe(0);
        expect(timeToX(10, view)).toBe(100);
    });

    it("pins to the canvas centre when the time span is zero", () => {
        const degenerate: Viewport = { ...view, xMin: 5, xMax: 5 };
        expect(timeToX(5, degenerate)).toBe(50);
        expect(timeToX(999, degenerate)).toBe(50);
    });

    it("propagates NaN for a non-finite time (no sanitising)", () => {
        expect(Number.isNaN(timeToX(Number.NaN, view))).toBe(true);
    });
});

describe("priceToY", () => {
    it("flips the price axis into the viewport height", () => {
        expect(priceToY(110, view)).toBe(0);
        expect(priceToY(100, view)).toBe(100);
        expect(priceToY(105, view)).toBe(50);
    });
});

describe("worldPointToPixel", () => {
    it("composes timeToX and priceToY", () => {
        expect(worldPointToPixel({ time: 5, price: 105 }, view)).toEqual({ x: 50, y: 50 });
    });
});
