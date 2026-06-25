// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { BAND, type RenderOrderMark, applyRenderOrder } from "./renderOrder.js";

function mark(z: number, band: number, seq: number, payload: string): RenderOrderMark<string> {
    return { z, band, seq, payload };
}

describe("BAND", () => {
    it("reproduces the canonical phase order series < glyph < hline < drawing", () => {
        expect(BAND.series).toBeLessThan(BAND.glyph);
        expect(BAND.glyph).toBeLessThan(BAND.hline);
        expect(BAND.hline).toBeLessThan(BAND.drawing);
    });
});

describe("applyRenderOrder", () => {
    it("at the default z=0 orders by band then seq (series → glyph → hline → drawing)", () => {
        const ordered = applyRenderOrder([
            mark(0, BAND.drawing, 0, "drawing"),
            mark(0, BAND.hline, 1, "hline"),
            mark(0, BAND.glyph, 2, "glyph"),
            mark(0, BAND.series, 3, "series"),
        ]);
        expect(ordered).toEqual(["series", "glyph", "hline", "drawing"]);
    });

    it("breaks a band tie by ascending seq (declaration order)", () => {
        const ordered = applyRenderOrder([
            mark(0, BAND.series, 2, "third"),
            mark(0, BAND.series, 0, "first"),
            mark(0, BAND.series, 1, "second"),
        ]);
        expect(ordered).toEqual(["first", "second", "third"]);
    });

    it("sorts a z<0 mark beneath z=0 marks regardless of band", () => {
        const ordered = applyRenderOrder([
            mark(0, BAND.series, 0, "series-z0"),
            mark(-1, BAND.drawing, 1, "drawing-zneg"),
        ]);
        expect(ordered[0]).toBe("drawing-zneg");
    });

    it("sorts a z>0 plot above a z=0 drawing", () => {
        const ordered = applyRenderOrder([
            mark(0, BAND.drawing, 0, "drawing-z0"),
            mark(1, BAND.series, 1, "series-zpos"),
        ]);
        expect(ordered[1]).toBe("series-zpos");
    });

    it("is a stable sort — equal (z, band, seq) keeps insertion order", () => {
        const ordered = applyRenderOrder([
            mark(0, BAND.series, 0, "fill"),
            mark(0, BAND.series, 0, "edge"),
        ]);
        expect(ordered).toEqual(["fill", "edge"]);
    });
});
