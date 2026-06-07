// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { CircleState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderCircle } from "./circle";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: CircleState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "circle",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderCircle", () => {
    it("strokes a beginPath → arc → closePath → stroke sequence (no fill when fill is omitted)", () => {
        const ctx = new MockCanvas2DContext();
        renderCircle(
            ctx,
            emission({
                kind: "circle",
                anchors: [
                    { time: 50, price: 50 },
                    { time: 75, price: 50 },
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
            "arc",
            "closePath",
            "stroke",
            "setLineDash",
        ]);
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#3b82f6" });
        expect(ctx.calls[1]).toEqual({ kind: "set", prop: "lineWidth", value: 2 });
    });

    it("computes the pixel-space radius from |edge - centre|", () => {
        const ctx = new MockCanvas2DContext();
        renderCircle(
            ctx,
            emission({
                kind: "circle",
                anchors: [
                    { time: 0, price: 50 },
                    { time: 25, price: 50 },
                ],
                style: {},
            }),
            VIEW,
        );
        // centre.x = 0, edge.x = 25 → pxWidth=800, span=100 → 0px, 200px
        // centre.y = priceToY(50) = 200; same for edge → radius = 200
        const arcCall = ctx.calls.find((c) => c.kind === "arc");
        expect(arcCall).toBeDefined();
        if (arcCall?.kind === "arc") {
            expect(arcCall.x).toBe(0);
            expect(arcCall.y).toBe(200);
            expect(arcCall.radius).toBe(200);
            expect(arcCall.start).toBe(0);
            expect(arcCall.end).toBeCloseTo(Math.PI * 2);
        }
    });

    it("fills with alpha-bracketed globalAlpha when style.fill is set", () => {
        const ctx = new MockCanvas2DContext();
        renderCircle(
            ctx,
            emission({
                kind: "circle",
                anchors: [
                    { time: 50, price: 50 },
                    { time: 60, price: 50 },
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
            "arc",
            "closePath",
            "set",
            "set",
            "fill",
            "set",
            "stroke",
            "setLineDash",
        ]);
        const alphaSets = ctx.calls.filter(
            (c) => c.kind === "set" && c.prop === "globalAlpha",
        );
        expect(alphaSets).toHaveLength(2);
        if (alphaSets[0].kind === "set" && alphaSets[1].kind === "set") {
            expect(alphaSets[0].value).toBe(0.4);
            expect(alphaSets[1].value).toBe(1);
        }
    });

    it("defaults stroke to #000000 and lineWidth to 1 when omitted", () => {
        const ctx = new MockCanvas2DContext();
        renderCircle(
            ctx,
            emission({
                kind: "circle",
                anchors: [
                    { time: 50, price: 50 },
                    { time: 60, price: 50 },
                ],
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#000000" });
        expect(ctx.calls[1]).toEqual({ kind: "set", prop: "lineWidth", value: 1 });
    });
});
