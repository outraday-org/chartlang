// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { HorizontalRayState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { priceToY, timeToX, type Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { renderHorizontalRay } from "./horizontalRay.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: HorizontalRayState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "horizontal-ray",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderHorizontalRay", () => {
    it("strokes from the projected anchor across to x = pxWidth at the anchor's y", () => {
        const ctx = new MockCanvas2DContext();
        renderHorizontalRay(
            ctx,
            emission({
                kind: "horizontal-ray",
                anchor: { time: 25, price: 75 },
                style: { color: "#10b981" },
            }),
            VIEW,
        );
        const moveTo = ctx.calls.find((c) => c.kind === "moveTo");
        const lineTo = ctx.calls.find((c) => c.kind === "lineTo");
        const x = timeToX(25, VIEW);
        const y = priceToY(75, VIEW);
        expect(moveTo).toEqual({ kind: "moveTo", x, y });
        expect(lineTo).toEqual({ kind: "lineTo", x: VIEW.pxWidth, y });
    });

    it("defaults stroke style to #000000 when style.color is omitted", () => {
        const ctx = new MockCanvas2DContext();
        renderHorizontalRay(
            ctx,
            emission({
                kind: "horizontal-ray",
                anchor: { time: 0, price: 50 },
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#000000" });
    });
});
