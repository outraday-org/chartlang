// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { BrushState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderBrush } from "./brush";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: BrushState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "brush",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const BRUSH_STATE: BrushState = {
    kind: "brush",
    anchors: [
        { time: 0, price: 0 },
        { time: 50, price: 50 },
        { time: 100, price: 0 },
    ],
    style: { stroke: "#000000", fill: "#dbeafe" },
};

describe("renderBrush", () => {
    it("strokes + fills the closed polyline (fill before stroke, with closePath)", () => {
        const ctx = new MockCanvas2DContext();
        renderBrush(ctx, emission(BRUSH_STATE), VIEW);
        const order = ctx.calls.map((c) => c.kind);
        const closeIdx = order.indexOf("closePath");
        const fillIdx = order.indexOf("fill");
        const strokeIdx = order.indexOf("stroke");
        expect(closeIdx).toBeGreaterThan(-1);
        expect(fillIdx).toBeGreaterThan(closeIdx);
        expect(strokeIdx).toBeGreaterThan(fillIdx);
    });

    it("sets fillStyle from style.fill and strokeStyle from style.stroke", () => {
        const ctx = new MockCanvas2DContext();
        renderBrush(ctx, emission(BRUSH_STATE), VIEW);
        const fillSet = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        const strokeSet = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (fillSet !== undefined && fillSet.kind === "set") {
            expect(fillSet.value).toBe("#dbeafe");
        }
        if (strokeSet !== undefined && strokeSet.kind === "set") {
            expect(strokeSet.value).toBe("#000000");
        }
    });

    it("issues exactly one beginPath / closePath / fill / stroke per call", () => {
        const ctx = new MockCanvas2DContext();
        renderBrush(ctx, emission(BRUSH_STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "beginPath")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "closePath")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
    });
});
