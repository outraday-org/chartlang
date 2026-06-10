// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { PenState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { renderPen } from "./pen.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: PenState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "pen",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const PEN_STATE: PenState = {
    kind: "pen",
    anchors: [
        { time: 0, price: 0 },
        { time: 50, price: 50 },
        { time: 100, price: 0 },
    ],
    style: { color: "#1e293b", lineWidth: 2 },
};

describe("renderPen", () => {
    it("strokes an OPEN polyline (no closePath, one stroke)", () => {
        const ctx = new MockCanvas2DContext();
        renderPen(ctx, emission(PEN_STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "closePath")).toHaveLength(0);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(2);
    });

    it("defaults stroke to #000000 and lineWidth to 1 when style omits them", () => {
        const ctx = new MockCanvas2DContext();
        renderPen(ctx, emission({ ...PEN_STATE, style: {} }), VIEW);
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#000000" });
        expect(ctx.calls[1]).toEqual({ kind: "set", prop: "lineWidth", value: 1 });
    });

    it("applies dashed lineStyle and resets to solid on exit", () => {
        const ctx = new MockCanvas2DContext();
        renderPen(ctx, emission({ ...PEN_STATE, style: { lineStyle: "dotted" } }), VIEW);
        const dashCalls = ctx.calls.filter((c) => c.kind === "setLineDash");
        expect(dashCalls).toHaveLength(2);
        if (dashCalls[0].kind === "setLineDash") expect(dashCalls[0].segments).toEqual([2, 4]);
        if (dashCalls[1].kind === "setLineDash") expect(dashCalls[1].segments).toEqual([]);
    });
});
