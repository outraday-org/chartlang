// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { ArrowState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { renderArrow } from "./arrow.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: ArrowState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "arrow",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const BASIC_STATE: ArrowState = {
    kind: "arrow",
    anchors: [
        { time: 0, price: 0 },
        { time: 100, price: 100 },
    ],
    style: { color: "#dc2626", lineWidth: 2 },
};

describe("renderArrow", () => {
    it("strokes the shaft once and fills exactly one arrowhead", () => {
        const ctx = new MockCanvas2DContext();
        renderArrow(ctx, emission(BASIC_STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(1);
    });

    it("defaults color to #000000 and lineWidth to 1 when style omits them", () => {
        const ctx = new MockCanvas2DContext();
        renderArrow(ctx, emission({ ...BASIC_STATE, style: {} }), VIEW);
        const strokeStyleCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        const lineWidthCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "lineWidth");
        if (strokeStyleCall?.kind === "set") expect(strokeStyleCall.value).toBe("#000000");
        if (lineWidthCall?.kind === "set") expect(lineWidthCall.value).toBe(1);
    });

    it("shares stroke + fill colour for shaft + arrowhead", () => {
        const ctx = new MockCanvas2DContext();
        renderArrow(ctx, emission(BASIC_STATE), VIEW);
        const strokeStyleCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        const fillStyleCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        if (strokeStyleCall?.kind === "set" && fillStyleCall?.kind === "set") {
            expect(strokeStyleCall.value).toBe("#dc2626");
            expect(fillStyleCall.value).toBe("#dc2626");
        }
    });

    it("issues no fillText call when style.label is undefined", () => {
        const ctx = new MockCanvas2DContext();
        renderArrow(ctx, emission(BASIC_STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(0);
    });

    it("paints the optional label at the shaft midpoint with center/bottom alignment", () => {
        const ctx = new MockCanvas2DContext();
        renderArrow(
            ctx,
            emission({ ...BASIC_STATE, style: { ...BASIC_STATE.style, label: "Sell" } }),
            VIEW,
        );
        const textCall = ctx.calls.find((c) => c.kind === "fillText");
        expect(textCall).toBeDefined();
        if (textCall?.kind === "fillText") {
            expect(textCall.text).toBe("Sell");
        }
        // The label paints AFTER the shaft + arrowhead, so the last
        // textAlign / textBaseline set right before fillText must be
        // "center" / "bottom".
        const textCallIdx = ctx.calls.findIndex((c) => c.kind === "fillText");
        const alignBefore = ctx.calls
            .slice(0, textCallIdx)
            .reverse()
            .find((c) => c.kind === "set" && c.prop === "textAlign");
        const baselineBefore = ctx.calls
            .slice(0, textCallIdx)
            .reverse()
            .find((c) => c.kind === "set" && c.prop === "textBaseline");
        if (alignBefore?.kind === "set") expect(alignBefore.value).toBe("center");
        if (baselineBefore?.kind === "set") expect(baselineBefore.value).toBe("bottom");
    });

    it("applies the lineStyle dash pattern and resets to solid afterwards", () => {
        const ctx = new MockCanvas2DContext();
        renderArrow(
            ctx,
            emission({ ...BASIC_STATE, style: { ...BASIC_STATE.style, lineStyle: "dashed" } }),
            VIEW,
        );
        const dashCalls = ctx.calls.filter((c) => c.kind === "setLineDash");
        expect(dashCalls).toHaveLength(2);
        if (dashCalls[0].kind === "setLineDash") expect(dashCalls[0].segments).toEqual([6, 4]);
        if (dashCalls[1].kind === "setLineDash") expect(dashCalls[1].segments).toEqual([]);
    });
});
