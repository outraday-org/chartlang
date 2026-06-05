// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../palette";
import { MockCanvas2DContext } from "../testing";
import { drawMarker } from "./marker";

describe("drawMarker", () => {
    it("circle emits one arc + closePath + fill, centred on (x, y)", () => {
        const ctx = new MockCanvas2DContext();
        drawMarker(
            ctx,
            { x: 100, y: 50, shape: "circle", size: 8, color: "#26a69a" },
            DEFAULT_PALETTE,
        );
        expect(ctx.calls).toEqual([
            { kind: "set", prop: "fillStyle", value: "#26a69a" },
            { kind: "beginPath" },
            { kind: "arc", x: 100, y: 50, radius: 4, start: 0, end: Math.PI * 2 },
            { kind: "closePath" },
            { kind: "fill" },
        ]);
    });

    it("square emits one fillRect centred on (x, y)", () => {
        const ctx = new MockCanvas2DContext();
        drawMarker(
            ctx,
            { x: 100, y: 50, shape: "square", size: 8, color: "#26a69a" },
            DEFAULT_PALETTE,
        );
        expect(ctx.calls).toEqual([
            { kind: "set", prop: "fillStyle", value: "#26a69a" },
            { kind: "fillRect", x: 96, y: 46, w: 8, h: 8 },
        ]);
    });

    it("triangle-up emits a 3-vertex polygon (apex up)", () => {
        const ctx = new MockCanvas2DContext();
        drawMarker(
            ctx,
            { x: 100, y: 50, shape: "triangle-up", size: 8, color: "#26a69a" },
            DEFAULT_PALETTE,
        );
        expect(ctx.calls.map((c) => c.kind)).toEqual([
            "set",
            "beginPath",
            "moveTo",
            "lineTo",
            "lineTo",
            "closePath",
            "fill",
        ]);
        const moves = ctx.calls.filter((c) => c.kind === "moveTo");
        expect(moves).toEqual([{ kind: "moveTo", x: 100, y: 46 }]);
    });

    it("triangle-down emits a 3-vertex polygon (apex down)", () => {
        const ctx = new MockCanvas2DContext();
        drawMarker(
            ctx,
            { x: 100, y: 50, shape: "triangle-down", size: 8, color: "#26a69a" },
            DEFAULT_PALETTE,
        );
        const moves = ctx.calls.filter((c) => c.kind === "moveTo");
        expect(moves).toEqual([{ kind: "moveTo", x: 100, y: 54 }]);
    });

    it("diamond emits a 4-vertex polygon centred on (x, y)", () => {
        const ctx = new MockCanvas2DContext();
        drawMarker(
            ctx,
            { x: 100, y: 50, shape: "diamond", size: 8, color: "#26a69a" },
            DEFAULT_PALETTE,
        );
        expect(ctx.calls.map((c) => c.kind)).toEqual([
            "set",
            "beginPath",
            "moveTo",
            "lineTo",
            "lineTo",
            "lineTo",
            "closePath",
            "fill",
        ]);
    });

    it("falls back to palette.plotDefault when color is null", () => {
        const ctx = new MockCanvas2DContext();
        drawMarker(ctx, { x: 0, y: 0, shape: "circle", size: 4, color: null }, DEFAULT_PALETTE);
        const setFill = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        expect(setFill).toEqual({
            kind: "set",
            prop: "fillStyle",
            value: DEFAULT_PALETTE.plotDefault,
        });
    });
});
