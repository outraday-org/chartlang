// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { monotoneCubicSegments } from "./monotoneSpline.js";

// Evaluate a cubic Bézier (start s, controls c1/c2, end e) at parameter t.
function bezier(s: number, c1: number, c2: number, e: number, t: number): number {
    const u = 1 - t;
    return u * u * u * s + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * e;
}

describe("monotoneCubicSegments", () => {
    it("returns [] for fewer than two points", () => {
        expect(monotoneCubicSegments([])).toEqual([]);
        expect(monotoneCubicSegments([{ x: 0, y: 0 }])).toEqual([]);
    });

    it("returns one segment per gap", () => {
        const segs = monotoneCubicSegments([
            { x: 0, y: 0 },
            { x: 1, y: 1 },
            { x: 2, y: 0 },
            { x: 3, y: 1 },
        ]);
        expect(segs.length).toBe(3);
    });

    it("every segment ends exactly on its data point (interpolation)", () => {
        const pts = [
            { x: 0, y: 5 },
            { x: 10, y: 25 },
            { x: 20, y: 15 },
            { x: 30, y: 40 },
        ];
        const segs = monotoneCubicSegments(pts);
        segs.forEach((s, i) => {
            expect(s.x).toBeCloseTo(pts[i + 1].x, 9);
            expect(s.y).toBeCloseTo(pts[i + 1].y, 9);
        });
    });

    it("a straight ramp stays straight (control points lie on the line)", () => {
        const segs = monotoneCubicSegments([
            { x: 0, y: 0 },
            { x: 10, y: 10 },
            { x: 20, y: 20 },
        ]);
        for (const s of segs) {
            // On y = x, every control point's y equals its x.
            expect(s.c1y).toBeCloseTo(s.c1x, 9);
            expect(s.c2y).toBeCloseTo(s.c2x, 9);
        }
    });

    it("does not overshoot a local peak (monotone: curve never exceeds the endpoints in a flat-then-rise)", () => {
        // A plateau then a step up: the middle segment must not dip below 10
        // or rise above 10 between the two equal-height points (tangent → 0).
        const pts = [
            { x: 0, y: 10 },
            { x: 1, y: 10 },
            { x: 2, y: 20 },
        ];
        const [flat] = monotoneCubicSegments(pts);
        for (let t = 0; t <= 1; t += 0.1) {
            const y = bezier(10, flat.c1y, flat.c2y, 10, t);
            expect(y).toBeCloseTo(10, 6);
        }
    });

    it("does not overshoot below endpoints on a V (sampled curve stays within the local range)", () => {
        const pts = [
            { x: 0, y: 20 },
            { x: 1, y: 10 },
            { x: 2, y: 20 },
        ];
        const segs = monotoneCubicSegments(pts);
        // Left segment falls 20→10 monotonically; never below 10 or above 20.
        for (let t = 0; t <= 1; t += 0.1) {
            const y = bezier(20, segs[0].c1y, segs[0].c2y, 10, t);
            expect(y).toBeGreaterThanOrEqual(10 - 1e-6);
            expect(y).toBeLessThanOrEqual(20 + 1e-6);
        }
    });

    it("degrades a zero-width gap to a straight chord (no divide-by-zero)", () => {
        const segs = monotoneCubicSegments([
            { x: 5, y: 1 },
            { x: 5, y: 2 }, // coincident x
            { x: 6, y: 3 },
        ]);
        expect(segs.length).toBe(2);
        for (const s of segs) {
            expect(Number.isFinite(s.c1x)).toBe(true);
            expect(Number.isFinite(s.c1y)).toBe(true);
            expect(Number.isFinite(s.c2x)).toBe(true);
            expect(Number.isFinite(s.c2y)).toBe(true);
        }
        // The degenerate gap's controls sit on its chord endpoints.
        expect(segs[0]).toEqual({ c1x: 5, c1y: 1, c2x: 5, c2y: 2, x: 5, y: 2 });
    });

    it("handles a zero-width gap at the trailing edge (last-point tangent falls back to 0)", () => {
        const segs = monotoneCubicSegments([
            { x: 0, y: 0 },
            { x: 1, y: 1 },
            { x: 1, y: 2 }, // coincident x at the end
        ]);
        expect(segs.length).toBe(2);
        expect(segs[1]).toEqual({ c1x: 1, c1y: 1, c2x: 1, c2y: 2, x: 1, y: 2 });
        for (const s of segs) {
            expect(Number.isFinite(s.c1y)).toBe(true);
            expect(Number.isFinite(s.c2y)).toBe(true);
        }
    });

    it("applies the Fritsch–Carlson clamp on a steep spike (tangents pulled in)", () => {
        // A sharp spike forces the monotonicity circle (alpha^2+beta^2 > 9)
        // branch; the curve must still not overshoot the 0→100 rise.
        const pts = [
            { x: 0, y: 0 },
            { x: 1, y: 100 },
            { x: 2, y: 101 },
        ];
        const segs = monotoneCubicSegments(pts);
        for (let t = 0; t <= 1; t += 0.05) {
            const y = bezier(0, segs[0].c1y, segs[0].c2y, 100, t);
            expect(y).toBeGreaterThanOrEqual(-1e-6);
            expect(y).toBeLessThanOrEqual(100 + 1e-6);
        }
    });
});
