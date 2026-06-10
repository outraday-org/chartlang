// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { ArcState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { renderArc } from "./arc.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: ArcState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "arc",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const ARC_STATE: ArcState = {
    kind: "arc",
    anchors: [
        { time: 0, price: 0 },
        { time: 50, price: 50 },
        { time: 100, price: 0 },
    ],
    style: { color: "#3b82f6", lineWidth: 2 },
};

describe("renderArc", () => {
    it("samples the arc as a 32-segment polyline (33 points → 1 moveTo + 32 lineTo)", () => {
        const ctx = new MockCanvas2DContext();
        renderArc(ctx, emission(ARC_STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "moveTo")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(32);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
    });

    it("defaults stroke to #000000 and lineWidth to 1 when style omits them", () => {
        const ctx = new MockCanvas2DContext();
        renderArc(
            ctx,
            emission({
                ...ARC_STATE,
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#000000" });
        expect(ctx.calls[1]).toEqual({ kind: "set", prop: "lineWidth", value: 1 });
    });

    it("applies the dashed lineStyle and resets to solid on exit", () => {
        const ctx = new MockCanvas2DContext();
        renderArc(
            ctx,
            emission({
                ...ARC_STATE,
                style: { lineStyle: "dashed" },
            }),
            VIEW,
        );
        const dashCalls = ctx.calls.filter((c) => c.kind === "setLineDash");
        expect(dashCalls).toHaveLength(2);
        if (dashCalls[0].kind === "setLineDash") expect(dashCalls[0].segments).toEqual([6, 4]);
        if (dashCalls[1].kind === "setLineDash") expect(dashCalls[1].segments).toEqual([]);
    });

    it("first moveTo coordinate matches the projected from-anchor", () => {
        const ctx = new MockCanvas2DContext();
        renderArc(ctx, emission(ARC_STATE), VIEW);
        const move = ctx.calls.find((c) => c.kind === "moveTo");
        expect(move).toBeDefined();
        // bars[0].time=0, view.xMin=0, xMax=100, pxWidth=800 → x = 0;
        // bars[0].price=0, view.yMin=0, yMax=100, pxHeight=400 → y = 400.
        if (move !== undefined && move.kind === "moveTo") {
            expect(move.x).toBe(0);
            expect(move.y).toBe(400);
        }
    });
});
