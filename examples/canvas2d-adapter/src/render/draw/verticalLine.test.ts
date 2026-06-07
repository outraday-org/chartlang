// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { VerticalLineState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { timeToX, type Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderVerticalLine } from "./verticalLine";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: VerticalLineState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "vertical-line",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderVerticalLine", () => {
    it("strokes from y=0 to y=pxHeight at timeToX(state.time)", () => {
        const ctx = new MockCanvas2DContext();
        renderVerticalLine(
            ctx,
            emission({ kind: "vertical-line", time: 25, style: { color: "#f97316" } }),
            VIEW,
        );
        const moveTo = ctx.calls.find((c) => c.kind === "moveTo");
        const lineTo = ctx.calls.find((c) => c.kind === "lineTo");
        const expectedX = timeToX(25, VIEW);
        expect(moveTo).toEqual({ kind: "moveTo", x: expectedX, y: 0 });
        expect(lineTo).toEqual({ kind: "lineTo", x: expectedX, y: VIEW.pxHeight });
    });

    it("defaults stroke style to #000000 when style.color is omitted", () => {
        const ctx = new MockCanvas2DContext();
        renderVerticalLine(ctx, emission({ kind: "vertical-line", time: 25, style: {} }), VIEW);
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#000000" });
    });
});
