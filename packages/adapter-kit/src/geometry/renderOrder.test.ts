// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { RENDER_BAND, type RenderOrderKey, sortByRenderOrder } from "./renderOrder.js";

const key = (z: number, band: number, seq: number): RenderOrderKey => ({ z, band, seq });

describe("RENDER_BAND", () => {
    it("orders the default phases series → glyph → hline → drawing", () => {
        expect(RENDER_BAND.series).toBeLessThan(RENDER_BAND.glyph);
        expect(RENDER_BAND.glyph).toBeLessThan(RENDER_BAND.hline);
        expect(RENDER_BAND.hline).toBeLessThan(RENDER_BAND.drawing);
    });
});

describe("sortByRenderOrder", () => {
    it("sorts ascending by z first", () => {
        const marks = [key(2, 0, 0), key(0, 0, 0), key(1, 0, 0)];
        sortByRenderOrder(marks);
        expect(marks.map((m) => m.z)).toEqual([0, 1, 2]);
    });

    it("breaks a z tie by band", () => {
        const marks = [key(0, RENDER_BAND.drawing, 0), key(0, RENDER_BAND.series, 0)];
        sortByRenderOrder(marks);
        expect(marks.map((m) => m.band)).toEqual([RENDER_BAND.series, RENDER_BAND.drawing]);
    });

    it("breaks a z+band tie by seq", () => {
        const marks = [key(0, 0, 5), key(0, 0, 2), key(0, 0, 9)];
        sortByRenderOrder(marks);
        expect(marks.map((m) => m.seq)).toEqual([2, 5, 9]);
    });

    it("sorts a negative z beneath z = 0", () => {
        const marks = [key(0, RENDER_BAND.series, 0), key(-1, RENDER_BAND.drawing, 1)];
        sortByRenderOrder(marks);
        expect(marks.map((m) => m.z)).toEqual([-1, 0]);
    });

    it("sorts in place and returns the same array reference", () => {
        const marks = [key(1, 0, 0), key(0, 0, 1)];
        const result = sortByRenderOrder(marks);
        expect(result).toBe(marks);
        expect(result[0]?.z).toBe(0);
    });

    it("returns an empty array unchanged", () => {
        const marks: RenderOrderKey[] = [];
        expect(sortByRenderOrder(marks)).toBe(marks);
        expect(marks).toHaveLength(0);
    });
});
