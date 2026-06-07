// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { RotatedRectangleState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderRotatedRectangle } from "./rotatedRectangle";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: RotatedRectangleState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "rotated-rectangle",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderRotatedRectangle", () => {
    it("walks the 4 corners as a closed polygon", () => {
        const ctx = new MockCanvas2DContext();
        renderRotatedRectangle(
            ctx,
            emission({
                kind: "rotated-rectangle",
                anchors: [
                    { time: 0, price: 50 },
                    { time: 50, price: 100 },
                    { time: 100, price: 50 },
                    { time: 50, price: 0 },
                ],
                style: { stroke: "#22c55e", lineWidth: 1 },
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
    });

    it("fills with alpha brackets when style.fill is set", () => {
        const ctx = new MockCanvas2DContext();
        renderRotatedRectangle(
            ctx,
            emission({
                kind: "rotated-rectangle",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 1, price: 1 },
                    { time: 2, price: 0 },
                    { time: 1, price: -1 },
                ],
                style: { fill: "#fef3c7", fillAlpha: 0.6 },
            }),
            VIEW,
        );
        const fillCall = ctx.calls.find((c) => c.kind === "fill");
        const alphaSets = ctx.calls.filter(
            (c) => c.kind === "set" && c.prop === "globalAlpha",
        );
        expect(fillCall).toBeDefined();
        expect(alphaSets).toHaveLength(2);
        if (alphaSets[0].kind === "set" && alphaSets[1].kind === "set") {
            expect(alphaSets[0].value).toBe(0.6);
            expect(alphaSets[1].value).toBe(1);
        }
    });

    it("projects all 4 corners — none collapse to the same pixel for a non-degenerate quad", () => {
        const ctx = new MockCanvas2DContext();
        renderRotatedRectangle(
            ctx,
            emission({
                kind: "rotated-rectangle",
                anchors: [
                    { time: 0, price: 50 },
                    { time: 50, price: 100 },
                    { time: 100, price: 50 },
                    { time: 50, price: 0 },
                ],
                style: {},
            }),
            VIEW,
        );
        const move = ctx.calls.find((c) => c.kind === "moveTo");
        const lines = ctx.calls.filter((c) => c.kind === "lineTo");
        expect(lines).toHaveLength(3);
        if (move?.kind === "moveTo") {
            const pts = [
                { x: move.x, y: move.y },
                ...lines.map((c) => (c.kind === "lineTo" ? { x: c.x, y: c.y } : { x: 0, y: 0 })),
            ];
            const unique = new Set(pts.map((p) => `${p.x},${p.y}`));
            expect(unique.size).toBe(4);
        }
    });
});
