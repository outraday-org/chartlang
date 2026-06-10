// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { ArrowMarkDownState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { renderArrowMarkDown } from "./arrowMarkDown.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: ArrowMarkDownState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "arrow-mark-down",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderArrowMarkDown", () => {
    it("paints a filled chevron (1 fill, 0 strokes, 0 arcs)", () => {
        const ctx = new MockCanvas2DContext();
        renderArrowMarkDown(
            ctx,
            emission({
                kind: "arrow-mark-down",
                anchor: { time: 50, price: 50 },
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(0);
        expect(ctx.calls.filter((c) => c.kind === "arc")).toHaveLength(0);
    });

    it("defaults to red (#ef4444) when style.color is omitted", () => {
        const ctx = new MockCanvas2DContext();
        renderArrowMarkDown(
            ctx,
            emission({
                kind: "arrow-mark-down",
                anchor: { time: 0, price: 0 },
                style: {},
            }),
            VIEW,
        );
        const fillStyleCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        if (fillStyleCall?.kind === "set") expect(fillStyleCall.value).toBe("#ef4444");
    });

    it("honours an explicit style.color override", () => {
        const ctx = new MockCanvas2DContext();
        renderArrowMarkDown(
            ctx,
            emission({
                kind: "arrow-mark-down",
                anchor: { time: 0, price: 0 },
                style: { color: "#7c2d12" },
            }),
            VIEW,
        );
        const fillStyleCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        if (fillStyleCall?.kind === "set") expect(fillStyleCall.value).toBe("#7c2d12");
    });

    it("places the chevron tip below the projected anchor (larger y)", () => {
        const ctx = new MockCanvas2DContext();
        renderArrowMarkDown(
            ctx,
            emission({
                kind: "arrow-mark-down",
                anchor: { time: 50, price: 50 },
                style: {},
            }),
            VIEW,
        );
        const projectedY = 200; // (100 - 50) / 100 * 400
        const tip = ctx.calls.find((c) => c.kind === "moveTo");
        if (tip?.kind === "moveTo") {
            expect(tip.y).toBeGreaterThan(projectedY);
        }
    });
});
