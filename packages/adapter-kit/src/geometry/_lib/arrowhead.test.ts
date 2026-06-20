// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { arrowheadPolygon } from "./arrowhead.js";

describe("arrowheadPolygon", () => {
    it("returns [tip, leftWing, rightWing] with the tip at `to`", () => {
        const tri = arrowheadPolygon({ x: 0, y: 0 }, { x: 100, y: 0 });
        expect(tri).toHaveLength(3);
        expect(tri[0]).toEqual({ x: 100, y: 0 });
        // Both wings trail behind the tip along the −x direction.
        expect(tri[1].x).toBeLessThan(100);
        expect(tri[2].x).toBeLessThan(100);
    });

    it("honours a custom size", () => {
        const small = arrowheadPolygon({ x: 0, y: 0 }, { x: 100, y: 0 }, 4);
        const big = arrowheadPolygon({ x: 0, y: 0 }, { x: 100, y: 0 }, 16);
        expect(100 - small[1].x).toBeLessThan(100 - big[1].x);
    });
});
