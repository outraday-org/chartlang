// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { EllipseState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderEllipse } from "./ellipse";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

const SEGMENTS = 64;

function emission(state: EllipseState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "ellipse",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderEllipse", () => {
    it(`strokes a beginPath → moveTo → ${SEGMENTS - 1} lineTo → closePath → stroke sequence`, () => {
        const ctx = new MockCanvas2DContext();
        renderEllipse(
            ctx,
            emission({
                kind: "ellipse",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                ],
                style: { stroke: "#22c55e", lineWidth: 2 },
            }),
            VIEW,
        );
        const lineTos = ctx.calls.filter((c) => c.kind === "lineTo");
        expect(lineTos).toHaveLength(SEGMENTS - 1);
        const beginPaths = ctx.calls.filter((c) => c.kind === "beginPath");
        const closePaths = ctx.calls.filter((c) => c.kind === "closePath");
        const strokes = ctx.calls.filter((c) => c.kind === "stroke");
        expect(beginPaths).toHaveLength(1);
        expect(closePaths).toHaveLength(1);
        expect(strokes).toHaveLength(1);
    });

    it("starts the polyline at (cx + rx, cy)", () => {
        const ctx = new MockCanvas2DContext();
        renderEllipse(
            ctx,
            emission({
                kind: "ellipse",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                ],
                style: {},
            }),
            VIEW,
        );
        // bbox: x∈[0,800], y∈[0,400] → cx=400, cy=200, rx=400, ry=200
        // moveTo (cx + rx, cy) = (800, 200)
        const moveTo = ctx.calls.find((c) => c.kind === "moveTo");
        if (moveTo?.kind === "moveTo") {
            expect(moveTo.x).toBe(800);
            expect(moveTo.y).toBe(200);
        }
    });

    it("fills with alpha-bracketed globalAlpha when style.fill is set", () => {
        const ctx = new MockCanvas2DContext();
        renderEllipse(
            ctx,
            emission({
                kind: "ellipse",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 50, price: 50 },
                ],
                style: { fill: "#dcfce7", fillAlpha: 0.3 },
            }),
            VIEW,
        );
        const fillCalls = ctx.calls.filter((c) => c.kind === "fill");
        expect(fillCalls).toHaveLength(1);
        const alphaSets = ctx.calls.filter((c) => c.kind === "set" && c.prop === "globalAlpha");
        expect(alphaSets).toHaveLength(2);
    });

    it("defaults stroke to #000000 and lineWidth to 1 when omitted", () => {
        const ctx = new MockCanvas2DContext();
        renderEllipse(
            ctx,
            emission({
                kind: "ellipse",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 50, price: 50 },
                ],
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#000000" });
        expect(ctx.calls[1]).toEqual({ kind: "set", prop: "lineWidth", value: 1 });
    });
});
