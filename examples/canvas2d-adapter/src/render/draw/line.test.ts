// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { LineState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { renderLine } from "./line.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: LineState, op: "create" | "update" = "create"): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "line",
        op,
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderLine", () => {
    it("strokes a beginPath → moveTo → lineTo → stroke sequence between the projected anchors", () => {
        const ctx = new MockCanvas2DContext();
        renderLine(
            ctx,
            emission({
                kind: "line",
                anchors: [
                    { time: 0, price: 100 },
                    { time: 100, price: 0 },
                ],
                style: { color: "#3b82f6", lineWidth: 2 },
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
            "stroke",
            "setLineDash",
        ]);
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#3b82f6" });
        expect(ctx.calls[1]).toEqual({ kind: "set", prop: "lineWidth", value: 2 });
    });

    it("defaults stroke style to #000000 and lineWidth to 1 when omitted", () => {
        const ctx = new MockCanvas2DContext();
        renderLine(
            ctx,
            emission({
                kind: "line",
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

    it("applies the dashed lineStyle and resets to solid on exit", () => {
        const ctx = new MockCanvas2DContext();
        renderLine(
            ctx,
            emission({
                kind: "line",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                ],
                style: { lineStyle: "dashed" },
            }),
            VIEW,
        );
        const dashCalls = ctx.calls.filter((c) => c.kind === "setLineDash");
        expect(dashCalls).toHaveLength(2);
        if (dashCalls[0].kind === "setLineDash") {
            expect(dashCalls[0].segments).toEqual([6, 4]);
        }
        if (dashCalls[1].kind === "setLineDash") {
            expect(dashCalls[1].segments).toEqual([]);
        }
    });

    it("extends right to the viewport edge when style.extendRight is true", () => {
        const ctx = new MockCanvas2DContext();
        renderLine(
            ctx,
            emission({
                kind: "line",
                anchors: [
                    { time: 0, price: 50 },
                    { time: 50, price: 50 },
                ],
                style: { extendRight: true },
            }),
            VIEW,
        );
        const lineTo = ctx.calls.find((c) => c.kind === "lineTo");
        expect(lineTo).toBeDefined();
        if (lineTo !== undefined && lineTo.kind === "lineTo") {
            expect(lineTo.x).toBe(VIEW.pxWidth);
        }
    });
});
