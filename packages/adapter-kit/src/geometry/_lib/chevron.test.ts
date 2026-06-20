// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { chevronPolygon } from "./chevron.js";

describe("chevronPolygon", () => {
    it("points the tip above the anchor for direction up", () => {
        const tri = chevronPolygon({ x: 100, y: 100 }, "up");
        expect(tri).toHaveLength(3);
        expect(tri[0]).toEqual({ x: 100, y: 95 });
        expect(tri[1]).toEqual({ x: 94, y: 105 });
        expect(tri[2]).toEqual({ x: 106, y: 105 });
    });

    it("points the tip below the anchor for direction down", () => {
        const tri = chevronPolygon({ x: 100, y: 100 }, "down");
        expect(tri[0]).toEqual({ x: 100, y: 105 });
        expect(tri[1]).toEqual({ x: 94, y: 95 });
        expect(tri[2]).toEqual({ x: 106, y: 95 });
    });

    it("honours custom base width and height", () => {
        const tri = chevronPolygon({ x: 0, y: 0 }, "up", 20, 40);
        expect(tri[0]).toEqual({ x: 0, y: -20 });
        expect(tri[1]).toEqual({ x: -10, y: 20 });
    });
});
