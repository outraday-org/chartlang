// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FlatTopBottomState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderFlatTopBottom } from "./flatTopBottom";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: FlatTopBottomState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "flat-top-bottom",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderFlatTopBottom", () => {
    it("strokes two horizontal rails spanning the leftEdge.time → rightEdge.time range", () => {
        const ctx = new MockCanvas2DContext();
        renderFlatTopBottom(
            ctx,
            emission({
                kind: "flat-top-bottom",
                anchors: [
                    { time: 0, price: 80 },
                    { time: 100, price: 80 },
                    { time: 0, price: 20 },
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
        // top price = max(80, 20) = 80 → y = 400 - 80/100 * 400 = 80.
        // bottom price = min(80, 20) = 20 → y = 400 - 20/100 * 400 = 320.
        expect(moves[0]).toMatchObject({ kind: "moveTo", x: 0, y: 80 });
        expect(moves[1]).toMatchObject({ kind: "lineTo", x: 800, y: 80 });
        expect(moves[2]).toMatchObject({ kind: "moveTo", x: 0, y: 320 });
        expect(moves[3]).toMatchObject({ kind: "lineTo", x: 800, y: 320 });
    });

    it("defaults strokeStyle to #000000 and lineWidth to 1 when omitted", () => {
        const ctx = new MockCanvas2DContext();
        renderFlatTopBottom(
            ctx,
            emission({
                kind: "flat-top-bottom",
                anchors: [
                    { time: 0, price: 50 },
                    { time: 100, price: 50 },
                    { time: 0, price: 25 },
                ],
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#000000" });
        expect(ctx.calls[1]).toEqual({ kind: "set", prop: "lineWidth", value: 1 });
    });

    it("handles the case where oppositeHook.price is higher than leftEdge.price", () => {
        const ctx = new MockCanvas2DContext();
        renderFlatTopBottom(
            ctx,
            emission({
                kind: "flat-top-bottom",
                anchors: [
                    { time: 0, price: 20 },
                    { time: 100, price: 20 },
                    { time: 0, price: 80 },
                ],
                style: {},
            }),
            VIEW,
        );
        const moves = ctx.calls.filter((c) => c.kind === "moveTo" || c.kind === "lineTo");
        // top price = max(20, 80) = 80 → y = 80. bottom price = min(20, 80) = 20 → y = 320.
        expect(moves[0]).toMatchObject({ kind: "moveTo", x: 0, y: 80 });
        expect(moves[2]).toMatchObject({ kind: "moveTo", x: 0, y: 320 });
    });
});
