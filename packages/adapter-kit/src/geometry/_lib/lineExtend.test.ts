// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Viewport } from "../types.js";
import { extendLineSegment } from "./lineExtend.js";

const view: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, pxWidth: 200, pxHeight: 200 };

describe("extendLineSegment", () => {
    const a = { x: 100, y: 100 };
    const b = { x: 150, y: 150 };

    it("returns the segment unchanged when no extension flag is set", () => {
        expect(extendLineSegment(a, b, {}, view)).toEqual({ from: a, to: b });
    });

    it("extends right to the viewport's right edge", () => {
        const { from, to } = extendLineSegment(a, b, { extendRight: true }, view);
        expect(from).toEqual(a);
        expect(to).toEqual({ x: 200, y: 200 });
    });

    it("extends left to x = 0", () => {
        const { from, to } = extendLineSegment(a, b, { extendLeft: true }, view);
        expect(from).toEqual({ x: 0, y: 0 });
        expect(to).toEqual(b);
    });

    it("extends both directions", () => {
        const { from, to } = extendLineSegment(a, b, { extendLeft: true, extendRight: true }, view);
        expect(from).toEqual({ x: 0, y: 0 });
        expect(to).toEqual({ x: 200, y: 200 });
    });

    it("returns a vertical segment unchanged (no x-edge intersection)", () => {
        const v0 = { x: 50, y: 10 };
        const v1 = { x: 50, y: 90 };
        expect(extendLineSegment(v0, v1, { extendLeft: true, extendRight: true }, view)).toEqual({
            from: v0,
            to: v1,
        });
    });
});
