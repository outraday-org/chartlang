// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { cubicBezier, quadraticBezier, sampleCubic, sampleQuadratic, type Point2 } from "./bezier.js";

const P0: Point2 = { x: 0, y: 0 };
const P1: Point2 = { x: 1, y: 2 };
const P2: Point2 = { x: 2, y: 0 };
const P3: Point2 = { x: 3, y: -1 };

describe("quadraticBezier", () => {
    it("returns p0 at t = 0 (float-exact)", () => {
        expect(quadraticBezier(P0, P1, P2, 0)).toEqual(P0);
    });

    it("returns p2 at t = 1 (float-exact)", () => {
        expect(quadraticBezier(P0, P1, P2, 1)).toEqual(P2);
    });

    it("returns the apex at t = 0.5 for the symmetric example", () => {
        const mid = quadraticBezier(P0, P1, P2, 0.5);
        expect(mid.x).toBeCloseTo(1, 12);
        expect(mid.y).toBeCloseTo(1, 12);
    });

    it("places the midpoint inside the convex hull of the control polygon", () => {
        const mid = quadraticBezier(P0, P1, P2, 0.5);
        const minX = Math.min(P0.x, P1.x, P2.x);
        const maxX = Math.max(P0.x, P1.x, P2.x);
        const minY = Math.min(P0.y, P1.y, P2.y);
        const maxY = Math.max(P0.y, P1.y, P2.y);
        expect(mid.x).toBeGreaterThanOrEqual(minX);
        expect(mid.x).toBeLessThanOrEqual(maxX);
        expect(mid.y).toBeGreaterThanOrEqual(minY);
        expect(mid.y).toBeLessThanOrEqual(maxY);
    });
});

describe("cubicBezier", () => {
    it("returns p0 at t = 0 (float-exact)", () => {
        expect(cubicBezier(P0, P1, P2, P3, 0)).toEqual(P0);
    });

    it("returns p3 at t = 1 (float-exact)", () => {
        expect(cubicBezier(P0, P1, P2, P3, 1)).toEqual(P3);
    });

    it("places the midpoint inside the convex hull of the control polygon", () => {
        const mid = cubicBezier(P0, P1, P2, P3, 0.5);
        const minX = Math.min(P0.x, P1.x, P2.x, P3.x);
        const maxX = Math.max(P0.x, P1.x, P2.x, P3.x);
        const minY = Math.min(P0.y, P1.y, P2.y, P3.y);
        const maxY = Math.max(P0.y, P1.y, P2.y, P3.y);
        expect(mid.x).toBeGreaterThanOrEqual(minX);
        expect(mid.x).toBeLessThanOrEqual(maxX);
        expect(mid.y).toBeGreaterThanOrEqual(minY);
        expect(mid.y).toBeLessThanOrEqual(maxY);
    });
});

describe("sampleQuadratic", () => {
    it("produces samples + 1 points", () => {
        expect(sampleQuadratic(P0, P1, P2, 4).length).toBe(5);
        expect(sampleQuadratic(P0, P1, P2, 16).length).toBe(17);
    });

    it("starts at p0 and ends at p2 (float-exact)", () => {
        const pts = sampleQuadratic(P0, P1, P2, 10);
        expect(pts[0]).toEqual(P0);
        expect(pts[pts.length - 1]).toEqual(P2);
    });

    it("samples every interior point inside the convex hull", () => {
        const pts = sampleQuadratic(P0, P1, P2, 20);
        const minX = Math.min(P0.x, P1.x, P2.x);
        const maxX = Math.max(P0.x, P1.x, P2.x);
        const minY = Math.min(P0.y, P1.y, P2.y);
        const maxY = Math.max(P0.y, P1.y, P2.y);
        for (const pt of pts) {
            expect(pt.x).toBeGreaterThanOrEqual(minX);
            expect(pt.x).toBeLessThanOrEqual(maxX);
            expect(pt.y).toBeGreaterThanOrEqual(minY);
            expect(pt.y).toBeLessThanOrEqual(maxY);
        }
    });
});

describe("sampleCubic", () => {
    it("produces samples + 1 points", () => {
        expect(sampleCubic(P0, P1, P2, P3, 4).length).toBe(5);
        expect(sampleCubic(P0, P1, P2, P3, 32).length).toBe(33);
    });

    it("starts at p0 and ends at p3 (float-exact)", () => {
        const pts = sampleCubic(P0, P1, P2, P3, 16);
        expect(pts[0]).toEqual(P0);
        expect(pts[pts.length - 1]).toEqual(P3);
    });

    it("samples every interior point inside the convex hull", () => {
        const pts = sampleCubic(P0, P1, P2, P3, 24);
        const minX = Math.min(P0.x, P1.x, P2.x, P3.x);
        const maxX = Math.max(P0.x, P1.x, P2.x, P3.x);
        const minY = Math.min(P0.y, P1.y, P2.y, P3.y);
        const maxY = Math.max(P0.y, P1.y, P2.y, P3.y);
        for (const pt of pts) {
            expect(pt.x).toBeGreaterThanOrEqual(minX);
            expect(pt.x).toBeLessThanOrEqual(maxX);
            expect(pt.y).toBeGreaterThanOrEqual(minY);
            expect(pt.y).toBeLessThanOrEqual(maxY);
        }
    });
});
