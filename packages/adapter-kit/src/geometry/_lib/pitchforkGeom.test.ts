// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Point2 } from "../types.js";
import { medianOriginFor, medianTargetFor } from "./pitchforkGeom.js";

const a: Point2 = { x: 0, y: 0 };
const b: Point2 = { x: 10, y: 20 };
const c: Point2 = { x: 30, y: 0 };
const midBC: Point2 = { x: 20, y: 10 };

describe("medianOriginFor", () => {
    it("standard → a", () => {
        expect(medianOriginFor("standard", a, b, c)).toEqual(a);
    });

    it("schiff → (a.x, mid(a.y, midBC.y))", () => {
        expect(medianOriginFor("schiff", a, b, c)).toEqual({ x: 0, y: 5 });
    });

    it("modifiedSchiff → mid(a, b)", () => {
        expect(medianOriginFor("modifiedSchiff", a, b, c)).toEqual({ x: 5, y: 10 });
    });

    it("inside → midBC", () => {
        expect(medianOriginFor("inside", a, b, c)).toEqual(midBC);
    });
});

describe("medianTargetFor", () => {
    it("inside → midBC + (c - midAB)", () => {
        // midAB = (5, 10); c - midAB = (25, -10); midBC + that = (45, 0).
        expect(medianTargetFor("inside", a, b, c)).toEqual({ x: 45, y: 0 });
    });

    it("non-inside variants → midBC", () => {
        expect(medianTargetFor("standard", a, b, c)).toEqual(midBC);
        expect(medianTargetFor("schiff", a, b, c)).toEqual(midBC);
        expect(medianTargetFor("modifiedSchiff", a, b, c)).toEqual(midBC);
    });
});
