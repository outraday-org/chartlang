// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { TriangleState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { renderTriangle } from "./triangle.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: TriangleState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "triangle",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderTriangle", () => {
    it("strokes a closed 3-vertex polygon", () => {
        const ctx = new MockCanvas2DContext();
        renderTriangle(
            ctx,
            emission({
                kind: "triangle",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 50, price: 100 },
                    { time: 100, price: 0 },
                ],
                style: { stroke: "#ef4444" },
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
            "closePath",
            "stroke",
            "setLineDash",
        ]);
    });

    it("fills with alpha brackets when style.fill is set", () => {
        const ctx = new MockCanvas2DContext();
        renderTriangle(
            ctx,
            emission({
                kind: "triangle",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 1, price: 1 },
                    { time: 2, price: 0 },
                ],
                style: { fill: "#fee2e2", fillAlpha: 0.5 },
            }),
            VIEW,
        );
        const setFillStyle = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        const alphaSets = ctx.calls.filter((c) => c.kind === "set" && c.prop === "globalAlpha");
        expect(setFillStyle).toEqual({ kind: "set", prop: "fillStyle", value: "#fee2e2" });
        expect(alphaSets).toHaveLength(2);
        if (alphaSets[0].kind === "set" && alphaSets[1].kind === "set") {
            expect(alphaSets[0].value).toBe(0.5);
            expect(alphaSets[1].value).toBe(1);
        }
    });

    it("defaults stroke to #000000 and lineWidth to 1", () => {
        const ctx = new MockCanvas2DContext();
        renderTriangle(
            ctx,
            emission({
                kind: "triangle",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 1, price: 1 },
                    { time: 2, price: 0 },
                ],
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#000000" });
        expect(ctx.calls[1]).toEqual({ kind: "set", prop: "lineWidth", value: 1 });
    });
});
