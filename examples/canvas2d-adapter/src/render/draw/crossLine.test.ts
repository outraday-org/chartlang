// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { CrossLineState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { priceToY, timeToX, type Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderCrossLine } from "./crossLine";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: CrossLineState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "cross-line",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderCrossLine", () => {
    it("strokes a horizontal pair followed by a vertical pair through the projected anchor", () => {
        const ctx = new MockCanvas2DContext();
        renderCrossLine(
            ctx,
            emission({
                kind: "cross-line",
                anchor: { time: 25, price: 75 },
                style: { color: "#a855f7" },
            }),
            VIEW,
        );
        const x = timeToX(25, VIEW);
        const y = priceToY(75, VIEW);
        const moveCalls = ctx.calls.filter((c) => c.kind === "moveTo");
        const lineCalls = ctx.calls.filter((c) => c.kind === "lineTo");
        expect(moveCalls[0]).toEqual({ kind: "moveTo", x: 0, y });
        expect(lineCalls[0]).toEqual({ kind: "lineTo", x: VIEW.pxWidth, y });
        expect(moveCalls[1]).toEqual({ kind: "moveTo", x, y: 0 });
        expect(lineCalls[1]).toEqual({ kind: "lineTo", x, y: VIEW.pxHeight });
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(2);
    });

    it("defaults stroke style to #000000 when style.color is omitted", () => {
        const ctx = new MockCanvas2DContext();
        renderCrossLine(
            ctx,
            emission({ kind: "cross-line", anchor: { time: 50, price: 50 }, style: {} }),
            VIEW,
        );
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#000000" });
    });
});
