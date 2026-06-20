// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { cubicBezier, quadraticBezier, sampleCubic, sampleQuadratic } from "./bezier.js";

describe("quadraticBezier", () => {
    it("is exact at the endpoints and the apex", () => {
        const p0 = { x: 0, y: 0 };
        const p1 = { x: 1, y: 2 };
        const p2 = { x: 2, y: 0 };
        expect(quadraticBezier(p0, p1, p2, 0)).toEqual(p0);
        expect(quadraticBezier(p0, p1, p2, 1)).toEqual(p2);
        expect(quadraticBezier(p0, p1, p2, 0.5)).toEqual({ x: 1, y: 1 });
    });
});

describe("cubicBezier", () => {
    it("is exact at the endpoints", () => {
        const p0 = { x: 0, y: 0 };
        const p1 = { x: 1, y: 3 };
        const p2 = { x: 2, y: 3 };
        const p3 = { x: 3, y: 0 };
        expect(cubicBezier(p0, p1, p2, p3, 0)).toEqual(p0);
        expect(cubicBezier(p0, p1, p2, p3, 1)).toEqual(p3);
    });
});

describe("sampleQuadratic", () => {
    it("returns samples + 1 points anchored at the endpoints", () => {
        const pts = sampleQuadratic({ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 0 }, 4);
        expect(pts).toHaveLength(5);
        expect(pts[0]).toEqual({ x: 0, y: 0 });
        expect(pts[4]).toEqual({ x: 2, y: 0 });
    });
});

describe("sampleCubic", () => {
    it("returns samples + 1 points anchored at the endpoints", () => {
        const pts = sampleCubic({ x: 0, y: 0 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 0 }, 8);
        expect(pts).toHaveLength(9);
        expect(pts[0]).toEqual({ x: 0, y: 0 });
        expect(pts[8]).toEqual({ x: 3, y: 0 });
    });
});
