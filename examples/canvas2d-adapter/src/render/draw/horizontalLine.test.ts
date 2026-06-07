// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { HorizontalLineState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { priceToY, type Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderHorizontalLine } from "./horizontalLine";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: HorizontalLineState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "horizontal-line",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderHorizontalLine", () => {
    it("strokes from x=0 to x=pxWidth at priceToY(state.price)", () => {
        const ctx = new MockCanvas2DContext();
        renderHorizontalLine(
            ctx,
            emission({ kind: "horizontal-line", price: 50, style: { color: "#ef4444" } }),
            VIEW,
        );
        const moveTo = ctx.calls.find((c) => c.kind === "moveTo");
        const lineTo = ctx.calls.find((c) => c.kind === "lineTo");
        const expectedY = priceToY(50, VIEW);
        expect(moveTo).toEqual({ kind: "moveTo", x: 0, y: expectedY });
        expect(lineTo).toEqual({ kind: "lineTo", x: VIEW.pxWidth, y: expectedY });
    });

    it("defaults stroke style to #000000 and lineWidth to 1 when omitted", () => {
        const ctx = new MockCanvas2DContext();
        renderHorizontalLine(ctx, emission({ kind: "horizontal-line", price: 50, style: {} }), VIEW);
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#000000" });
        expect(ctx.calls[1]).toEqual({ kind: "set", prop: "lineWidth", value: 1 });
    });

    it("applies dotted lineStyle and resets to solid on exit", () => {
        const ctx = new MockCanvas2DContext();
        renderHorizontalLine(
            ctx,
            emission({ kind: "horizontal-line", price: 50, style: { lineStyle: "dotted" } }),
            VIEW,
        );
        const dashCalls = ctx.calls.filter((c) => c.kind === "setLineDash");
        if (dashCalls[0].kind === "setLineDash") {
            expect(dashCalls[0].segments).toEqual([2, 4]);
        }
        if (dashCalls[1].kind === "setLineDash") {
            expect(dashCalls[1].segments).toEqual([]);
        }
    });
});
