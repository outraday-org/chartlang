// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { TrianglePatternState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderTrianglePattern } from "./trianglePattern";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: TrianglePatternState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "triangle-pattern",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const STATE: TrianglePatternState = {
    kind: "triangle-pattern",
    anchors: [
        { time: 80, price: 50 },
        { time: 0, price: 70 },
        { time: 0, price: 30 },
    ],
    style: {},
};

describe("renderTrianglePattern", () => {
    it("strokes a 2-leg open polyline + labels A/B/C", () => {
        const ctx = new MockCanvas2DContext();
        renderTrianglePattern(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(2);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        const texts = ctx.calls
            .filter((c) => c.kind === "fillText")
            .map((c) => (c.kind === "fillText" ? c.text : ""));
        expect(texts).toEqual(["A", "B", "C"]);
    });

    it("defaults to amber #f59e0b", () => {
        const ctx = new MockCanvas2DContext();
        renderTrianglePattern(ctx, emission(STATE), VIEW);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#f59e0b");
    });

    it("honours style.color", () => {
        const ctx = new MockCanvas2DContext();
        renderTrianglePattern(
            ctx,
            emission({ ...STATE, style: { color: "#abcdef" } }),
            VIEW,
        );
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#abcdef");
    });

    it("emits no fills (stroked-only)", () => {
        const ctx = new MockCanvas2DContext();
        renderTrianglePattern(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });
});
