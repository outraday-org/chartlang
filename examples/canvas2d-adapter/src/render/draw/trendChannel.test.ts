// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { TrendChannelState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderTrendChannel } from "./trendChannel";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: TrendChannelState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "trend-channel",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderTrendChannel", () => {
    it("strokes two parallel line segments with the resolved style", () => {
        const ctx = new MockCanvas2DContext();
        renderTrendChannel(
            ctx,
            emission({
                kind: "trend-channel",
                anchors: [
                    { time: 0, price: 100 },
                    { time: 100, price: 0 },
                    { time: 0, price: 50 },
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
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#3b82f6" });
        expect(ctx.calls[1]).toEqual({ kind: "set", prop: "lineWidth", value: 2 });
    });

    it("defaults strokeStyle to #000000 and lineWidth to 1 when omitted", () => {
        const ctx = new MockCanvas2DContext();
        renderTrendChannel(
            ctx,
            emission({
                kind: "trend-channel",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                    { time: 0, price: 50 },
                ],
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#000000" });
        expect(ctx.calls[1]).toEqual({ kind: "set", prop: "lineWidth", value: 1 });
    });

    it("translates the parallel rail by the (anchors[0] → anchors[2]) offset", () => {
        const ctx = new MockCanvas2DContext();
        renderTrendChannel(
            ctx,
            emission({
                kind: "trend-channel",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                    { time: 0, price: 50 },
                ],
                style: {},
            }),
            VIEW,
        );
        const moves = ctx.calls.filter((c) => c.kind === "moveTo" || c.kind === "lineTo");
        // anchor[0] = (0, 0) → (0, 400); anchor[1] = (100, 100) → (800, 0).
        // anchor[2] = (0, 50) → (0, 200). Offset = (0, -200).
        // Primary line: (0, 400) → (800, 0). Parallel line: (0, 200) → (800, -200).
        expect(moves[0]).toMatchObject({ kind: "moveTo", x: 0, y: 400 });
        expect(moves[1]).toMatchObject({ kind: "lineTo", x: 800, y: 0 });
        expect(moves[2]).toMatchObject({ kind: "moveTo", x: 0, y: 200 });
        expect(moves[3]).toMatchObject({ kind: "lineTo", x: 800, y: -200 });
    });
});
