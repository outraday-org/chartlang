// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { extendLineSegment } from "./lineExtend";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

describe("extendLineSegment", () => {
    it("returns the segment unchanged when neither flag is set", () => {
        const a = { x: 100, y: 100 };
        const b = { x: 200, y: 200 };
        const { from, to } = extendLineSegment(a, b, {}, VIEW);
        expect(from).toEqual(a);
        expect(to).toEqual(b);
    });

    it("extends right to the viewport's right edge along the segment direction", () => {
        const a = { x: 100, y: 100 };
        const b = { x: 200, y: 200 };
        const { from, to } = extendLineSegment(a, b, { extendRight: true }, VIEW);
        expect(from).toEqual(a);
        expect(to.x).toBe(VIEW.pxWidth);
        // y at x = pxWidth: y = b.y + ((pxWidth - b.x) / dx) * dy
        //                  = 200 + (600 / 100) * 100 = 800
        expect(to.y).toBeCloseTo(800);
    });

    it("extends left to x = 0 along the segment direction", () => {
        const a = { x: 100, y: 100 };
        const b = { x: 200, y: 200 };
        const { from, to } = extendLineSegment(a, b, { extendLeft: true }, VIEW);
        // t = -a.x / dx = -100 / 100 = -1 → from = a + (-1) * (b - a)
        //   = (100 - 100, 100 - 100) = (0, 0)
        expect(from.x).toBe(0);
        expect(from.y).toBeCloseTo(0);
        expect(to).toEqual(b);
    });

    it("extends both directions independently", () => {
        const a = { x: 100, y: 100 };
        const b = { x: 200, y: 200 };
        const { from, to } = extendLineSegment(a, b, { extendLeft: true, extendRight: true }, VIEW);
        expect(from.x).toBe(0);
        expect(to.x).toBe(VIEW.pxWidth);
    });

    it("returns the segment unchanged for purely vertical segments (dx === 0)", () => {
        const a = { x: 100, y: 100 };
        const b = { x: 100, y: 200 };
        const { from, to } = extendLineSegment(a, b, { extendLeft: true, extendRight: true }, VIEW);
        expect(from).toEqual(a);
        expect(to).toEqual(b);
    });
});
