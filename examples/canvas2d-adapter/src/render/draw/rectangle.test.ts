// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { RectangleState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderRectangle } from "./rectangle";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: RectangleState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "rectangle",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderRectangle", () => {
    it("strokes a 4-corner closed polygon at the projected anchors (no fill when fill is omitted)", () => {
        const ctx = new MockCanvas2DContext();
        renderRectangle(
            ctx,
            emission({
                kind: "rectangle",
                anchors: [
                    { time: 0, price: 100 },
                    { time: 100, price: 0 },
                ],
                style: { stroke: "#3b82f6", lineWidth: 2 },
            }),
            VIEW,
        );
        const sequence = ctx.calls.map((c) => c.kind);
        expect(sequence).toEqual([
            "set",
            "set",
            "setLineDash",
            "beginPath",
            "moveTo",
            "lineTo",
            "lineTo",
            "lineTo",
            "closePath",
            "stroke",
            "setLineDash",
        ]);
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#3b82f6" });
        expect(ctx.calls[1]).toEqual({ kind: "set", prop: "lineWidth", value: 2 });
    });

    it("fills with alpha-bracketed globalAlpha when style.fill is set", () => {
        const ctx = new MockCanvas2DContext();
        renderRectangle(
            ctx,
            emission({
                kind: "rectangle",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 50, price: 50 },
                ],
                style: { fill: "#dbeafe", fillAlpha: 0.4 },
            }),
            VIEW,
        );
        const sequence = ctx.calls.map((c) => c.kind);
        expect(sequence).toEqual([
            "set",
            "set",
            "setLineDash",
            "beginPath",
            "moveTo",
            "lineTo",
            "lineTo",
            "lineTo",
            "closePath",
            "set",
            "set",
            "fill",
            "set",
            "stroke",
            "setLineDash",
        ]);
        const setFillStyle = ctx.calls.find(
            (c) => c.kind === "set" && c.prop === "fillStyle",
        );
        const alphaSets = ctx.calls.filter(
            (c) => c.kind === "set" && c.prop === "globalAlpha",
        );
        expect(setFillStyle).toEqual({ kind: "set", prop: "fillStyle", value: "#dbeafe" });
        expect(alphaSets).toHaveLength(2);
        if (alphaSets[0].kind === "set" && alphaSets[1].kind === "set") {
            expect(alphaSets[0].value).toBe(0.4);
            expect(alphaSets[1].value).toBe(1);
        }
    });

    it("defaults stroke to #000000 and lineWidth to 1 when omitted", () => {
        const ctx = new MockCanvas2DContext();
        renderRectangle(
            ctx,
            emission({
                kind: "rectangle",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                ],
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#000000" });
        expect(ctx.calls[1]).toEqual({ kind: "set", prop: "lineWidth", value: 1 });
    });

    it("walks the four corners CCW from the axis-aligned bounding box of the anchors", () => {
        const ctx = new MockCanvas2DContext();
        renderRectangle(
            ctx,
            emission({
                kind: "rectangle",
                anchors: [
                    { time: 25, price: 75 },
                    { time: 75, price: 25 },
                ],
                style: {},
            }),
            VIEW,
        );
        // xMin = 25 → 800 * 0.25 = 200; xMax = 75 → 600
        // yMin (price=75) → 400 * (1 - 0.75) = 100; yMax (price=25) → 300
        const moveTo = ctx.calls.find((c) => c.kind === "moveTo");
        const lineTos = ctx.calls.filter((c) => c.kind === "lineTo");
        if (moveTo?.kind === "moveTo") {
            expect(moveTo).toEqual({ kind: "moveTo", x: 200, y: 100 });
        }
        expect(lineTos).toHaveLength(3);
    });
});
