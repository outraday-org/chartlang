// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

const VIEW: Viewport = {
    xMin: 1_700_000_000_000,
    xMax: 1_700_000_009_000,
    yMin: 100,
    yMax: 110,
    pxWidth: 800,
    pxHeight: 400,
};

describe("worldPointToCanvas", () => {
    it("maps the left-time / max-price anchor to (0, 0)", () => {
        const px = worldPointToCanvas({ time: VIEW.xMin, price: VIEW.yMax }, VIEW);
        expect(px.x).toBe(0);
        expect(px.y).toBe(0);
    });

    it("maps the right-time / min-price anchor to (pxWidth, pxHeight)", () => {
        const px = worldPointToCanvas({ time: VIEW.xMax, price: VIEW.yMin }, VIEW);
        expect(px.x).toBe(VIEW.pxWidth);
        expect(px.y).toBe(VIEW.pxHeight);
    });

    it("maps the centre time / centre price to (pxWidth/2, pxHeight/2)", () => {
        const centreTime = (VIEW.xMin + VIEW.xMax) / 2;
        const centrePrice = (VIEW.yMin + VIEW.yMax) / 2;
        const px = worldPointToCanvas({ time: centreTime, price: centrePrice }, VIEW);
        expect(px.x).toBe(VIEW.pxWidth / 2);
        expect(px.y).toBe(VIEW.pxHeight / 2);
    });

    it("produces finite off-range numbers for off-screen world points", () => {
        const before = worldPointToCanvas({ time: VIEW.xMin - 1_000, price: 200 }, VIEW);
        const after = worldPointToCanvas({ time: VIEW.xMax + 1_000, price: -50 }, VIEW);
        expect(Number.isFinite(before.x)).toBe(true);
        expect(Number.isFinite(before.y)).toBe(true);
        expect(Number.isFinite(after.x)).toBe(true);
        expect(Number.isFinite(after.y)).toBe(true);
        expect(before.x).toBeLessThan(0);
        expect(after.x).toBeGreaterThan(VIEW.pxWidth);
    });

    it("returns an object whose shape is { x, y }", () => {
        const px = worldPointToCanvas({ time: VIEW.xMin, price: VIEW.yMin }, VIEW);
        expect(Object.keys(px).sort()).toEqual(["x", "y"]);
    });
});
