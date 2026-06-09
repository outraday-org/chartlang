// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../palette";
import { MockCanvas2DContext } from "../testing";
import { drawShape } from "./shape";

describe("drawShape", () => {
    it("renders marker-compatible glyphs with location offset", () => {
        const ctx = new MockCanvas2DContext();
        drawShape(
            ctx,
            { x: 20, y: 30, shape: "triangle-up", size: 8, location: "below", color: "#fff" },
            DEFAULT_PALETTE,
        );
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "fillStyle", value: "#fff" });
        expect(ctx.calls[2]).toEqual({ kind: "moveTo", x: 20, y: 36 });
    });

    it("renders cross using a deterministic stroke path", () => {
        const ctx = new MockCanvas2DContext();
        drawShape(ctx, { x: 10, y: 20, shape: "cross", size: 6, color: null }, DEFAULT_PALETTE);
        expect(ctx.calls).toEqual([
            { kind: "set", prop: "strokeStyle", value: DEFAULT_PALETTE.plotDefault },
            { kind: "set", prop: "lineWidth", value: 1 },
            { kind: "beginPath" },
            { kind: "moveTo", x: 7, y: 20 },
            { kind: "lineTo", x: 13, y: 20 },
            { kind: "moveTo", x: 10, y: 17 },
            { kind: "lineTo", x: 10, y: 23 },
            { kind: "stroke" },
        ]);
    });

    it("renders xcross and flag branches", () => {
        const xcross = new MockCanvas2DContext();
        drawShape(
            xcross,
            { x: 10, y: 20, shape: "xcross", size: 6, color: "#fff" },
            DEFAULT_PALETTE,
        );
        expect(xcross.calls.map((c) => c.kind)).toEqual([
            "set",
            "set",
            "beginPath",
            "moveTo",
            "lineTo",
            "moveTo",
            "lineTo",
            "stroke",
        ]);

        const flag = new MockCanvas2DContext();
        drawShape(flag, { x: 10, y: 20, shape: "flag", size: 6, color: "#fff" }, DEFAULT_PALETTE);
        expect(flag.calls.map((c) => c.kind)).toEqual([
            "set",
            "set",
            "beginPath",
            "moveTo",
            "lineTo",
            "lineTo",
            "lineTo",
            "stroke",
        ]);
    });

    it("renders above anchor branch", () => {
        const ctx = new MockCanvas2DContext();
        drawShape(
            ctx,
            { x: 10, y: 20, shape: "square", size: 8, location: "above", color: "#fff" },
            DEFAULT_PALETTE,
        );
        expect(ctx.calls[1]).toEqual({ kind: "fillRect", x: 6, y: 6, w: 8, h: 8 });
    });
});
