// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { cubicBezier, quadraticBezier, sampleCubic, sampleQuadratic, type Point2 } from "./bezier";

function pseudo(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1_664_525 + 1_013_904_223) >>> 0;
        return s / 0x1_0000_0000;
    };
}

function randomPoint(rng: () => number): Point2 {
    return { x: rng() * 1_000 - 500, y: rng() * 1_000 - 500 };
}

describe("bezier — property", () => {
    it("quadraticBezier endpoint identity (200 random triples)", () => {
        const rng = pseudo(0xc0ffee);
        for (let i = 0; i < 200; i++) {
            const p0 = randomPoint(rng);
            const p1 = randomPoint(rng);
            const p2 = randomPoint(rng);
            expect(quadraticBezier(p0, p1, p2, 0)).toEqual(p0);
            expect(quadraticBezier(p0, p1, p2, 1)).toEqual(p2);
        }
    });

    it("cubicBezier endpoint identity (200 random quads)", () => {
        const rng = pseudo(0xdecaf);
        for (let i = 0; i < 200; i++) {
            const p0 = randomPoint(rng);
            const p1 = randomPoint(rng);
            const p2 = randomPoint(rng);
            const p3 = randomPoint(rng);
            expect(cubicBezier(p0, p1, p2, p3, 0)).toEqual(p0);
            expect(cubicBezier(p0, p1, p2, p3, 1)).toEqual(p3);
        }
    });

    it("sampleQuadratic length === samples + 1 across a sweep", () => {
        const rng = pseudo(0xbeef);
        const p0 = randomPoint(rng);
        const p1 = randomPoint(rng);
        const p2 = randomPoint(rng);
        for (const samples of [1, 2, 5, 10, 50, 100, 500]) {
            expect(sampleQuadratic(p0, p1, p2, samples).length).toBe(samples + 1);
        }
    });

    it("sampleCubic length === samples + 1 across a sweep", () => {
        const rng = pseudo(0xface);
        const p0 = randomPoint(rng);
        const p1 = randomPoint(rng);
        const p2 = randomPoint(rng);
        const p3 = randomPoint(rng);
        for (const samples of [1, 2, 5, 10, 50, 100, 500]) {
            expect(sampleCubic(p0, p1, p2, p3, samples).length).toBe(samples + 1);
        }
    });

    it("quadraticBezier is continuous — adjacent sample distances are bounded", () => {
        const rng = pseudo(0x1234);
        const p0 = { x: 0, y: 0 };
        const p1 = { x: rng() * 100, y: rng() * 100 };
        const p2 = { x: 100, y: 0 };
        const N = 200;
        const pts = sampleQuadratic(p0, p1, p2, N);
        const hullDiag = Math.hypot(
            Math.max(p0.x, p1.x, p2.x) - Math.min(p0.x, p1.x, p2.x),
            Math.max(p0.y, p1.y, p2.y) - Math.min(p0.y, p1.y, p2.y),
        );
        for (let i = 1; i < pts.length; i++) {
            const dx = pts[i].x - pts[i - 1].x;
            const dy = pts[i].y - pts[i - 1].y;
            // Adjacent samples never jump more than the hull diagonal —
            // a far weaker bound than necessary, but it pins continuity.
            expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(hullDiag);
        }
    });
});
