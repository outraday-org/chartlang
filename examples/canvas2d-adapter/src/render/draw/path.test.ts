// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { PathState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderPath } from "./path";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: PathState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "path",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderPath", () => {
    it("strokes an OPEN polyline (no closePath when style.closed is omitted)", () => {
        const ctx = new MockCanvas2DContext();
        renderPath(
            ctx,
            emission({
                kind: "path",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 50, price: 50 },
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
            "lineTo",
            "stroke",
            "setLineDash",
        ]);
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#3b82f6" });
    });

    it("issues closePath when style.closed === true", () => {
        const ctx = new MockCanvas2DContext();
        renderPath(
            ctx,
            emission({
                kind: "path",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 50, price: 50 },
                    { time: 100, price: 0 },
                ],
                style: { closed: true },
            }),
            VIEW,
        );
        const closePaths = ctx.calls.filter((c) => c.kind === "closePath");
        expect(closePaths).toHaveLength(1);
    });

    it("defaults stroke to #000000 and lineWidth to 1", () => {
        const ctx = new MockCanvas2DContext();
        renderPath(
            ctx,
            emission({
                kind: "path",
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
        renderPath(
            ctx,
            emission({
                kind: "path",
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
});
