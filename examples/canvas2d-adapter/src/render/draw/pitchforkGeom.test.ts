// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Point2 } from "./bezier";
import { medianOriginFor, medianTargetFor } from "./pitchforkGeom";

const A: Point2 = { x: 0, y: 0 };
const B: Point2 = { x: 10, y: 10 };
const C: Point2 = { x: 20, y: 0 };
// mid(B, C) = (15, 5); mid(A, B) = (5, 5).

describe("medianOriginFor", () => {
    it("'standard' returns a", () => {
        expect(medianOriginFor("standard", A, B, C)).toEqual({ x: 0, y: 0 });
    });

    it("'schiff' returns (a.x, mid(a.y, midBC.y))", () => {
        expect(medianOriginFor("schiff", A, B, C)).toEqual({ x: 0, y: 2.5 });
    });

    it("'modifiedSchiff' returns mid(a, b)", () => {
        expect(medianOriginFor("modifiedSchiff", A, B, C)).toEqual({ x: 5, y: 5 });
    });

    it("'inside' returns mid(b, c)", () => {
        expect(medianOriginFor("inside", A, B, C)).toEqual({ x: 15, y: 5 });
    });

    it("returns distinct origins for the 4 variants on a non-degenerate triple", () => {
        const origins = new Set<string>();
        for (const v of ["standard", "schiff", "modifiedSchiff", "inside"] as const) {
            const o = medianOriginFor(v, A, B, C);
            origins.add(`${o.x},${o.y}`);
        }
        expect(origins.size).toBe(4);
    });
});

describe("medianTargetFor", () => {
    it("'standard' returns mid(b, c)", () => {
        expect(medianTargetFor("standard", A, B, C)).toEqual({ x: 15, y: 5 });
    });

    it("'schiff' returns mid(b, c)", () => {
        expect(medianTargetFor("schiff", A, B, C)).toEqual({ x: 15, y: 5 });
    });

    it("'modifiedSchiff' returns mid(b, c)", () => {
        expect(medianTargetFor("modifiedSchiff", A, B, C)).toEqual({ x: 15, y: 5 });
    });

    it("'inside' returns midBC + (c - midAB)", () => {
        // midAB = (5, 5); c - midAB = (15, -5); midBC + that = (30, 0).
        expect(medianTargetFor("inside", A, B, C)).toEqual({ x: 30, y: 0 });
    });

    it("returns finite coordinates for any non-degenerate triple", () => {
        for (const v of ["standard", "schiff", "modifiedSchiff", "inside"] as const) {
            const t = medianTargetFor(v, A, B, C);
            expect(Number.isFinite(t.x)).toBe(true);
            expect(Number.isFinite(t.y)).toBe(true);
        }
    });
});
