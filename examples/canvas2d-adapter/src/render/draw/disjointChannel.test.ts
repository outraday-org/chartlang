// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { DisjointChannelState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderDisjointChannel } from "./disjointChannel";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: DisjointChannelState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "disjoint-channel",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderDisjointChannel", () => {
    it("strokes two independent line segments", () => {
        const ctx = new MockCanvas2DContext();
        renderDisjointChannel(
            ctx,
            emission({
                kind: "disjoint-channel",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                    { time: 0, price: 50 },
                    { time: 100, price: 50 },
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
            "beginPath",
            "moveTo",
            "lineTo",
            "stroke",
            "setLineDash",
        ]);
        const moves = ctx.calls.filter((c) => c.kind === "moveTo" || c.kind === "lineTo");
        expect(moves[0]).toMatchObject({ kind: "moveTo", x: 0, y: 400 });
        expect(moves[1]).toMatchObject({ kind: "lineTo", x: 800, y: 0 });
        expect(moves[2]).toMatchObject({ kind: "moveTo", x: 0, y: 200 });
        expect(moves[3]).toMatchObject({ kind: "lineTo", x: 800, y: 200 });
    });

    it("defaults strokeStyle to #000000 and lineWidth to 1 when omitted", () => {
        const ctx = new MockCanvas2DContext();
        renderDisjointChannel(
            ctx,
            emission({
                kind: "disjoint-channel",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                    { time: 0, price: 50 },
                    { time: 100, price: 50 },
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
        renderDisjointChannel(
            ctx,
            emission({
                kind: "disjoint-channel",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                    { time: 0, price: 50 },
                    { time: 100, price: 50 },
                ],
                style: { lineStyle: "dashed" },
            }),
            VIEW,
        );
        const setDash = ctx.calls.filter((c) => c.kind === "setLineDash");
        expect(setDash).toHaveLength(2);
        const last = setDash[setDash.length - 1];
        expect(last).toMatchObject({ kind: "setLineDash", segments: [] });
    });
});
