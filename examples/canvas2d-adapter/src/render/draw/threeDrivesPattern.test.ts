// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { ThreeDrivesPatternState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderThreeDrivesPattern } from "./threeDrivesPattern";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: ThreeDrivesPatternState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "three-drives-pattern",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const STATE: ThreeDrivesPatternState = {
    kind: "three-drives-pattern",
    anchors: [
        { time: 0, price: 0 },
        { time: 15, price: 30 },
        { time: 30, price: 20 },
        { time: 45, price: 50 },
        { time: 60, price: 40 },
        { time: 75, price: 70 },
        { time: 90, price: 60 },
    ],
    style: {},
};

describe("renderThreeDrivesPattern", () => {
    it("strokes a 6-leg open polyline + labels all 7 pivots", () => {
        const ctx = new MockCanvas2DContext();
        renderThreeDrivesPattern(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(6);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        const texts = ctx.calls
            .filter((c) => c.kind === "fillText")
            .map((c) => (c.kind === "fillText" ? c.text : ""));
        expect(texts).toEqual(["S", "D1", "R1", "D2", "R2", "D3", "E"]);
    });

    it("defaults to amber #f59e0b", () => {
        const ctx = new MockCanvas2DContext();
        renderThreeDrivesPattern(ctx, emission(STATE), VIEW);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#f59e0b");
    });

    it("honours style.color + style.lineWidth", () => {
        const ctx = new MockCanvas2DContext();
        renderThreeDrivesPattern(
            ctx,
            emission({ ...STATE, style: { color: "#abcdef", lineWidth: 2 } }),
            VIEW,
        );
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        const width = ctx.calls.find((c) => c.kind === "set" && c.prop === "lineWidth");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#abcdef");
        if (width?.kind === "set") expect(width.value).toBe(2);
    });

    it("emits no fills (stroked-only)", () => {
        const ctx = new MockCanvas2DContext();
        renderThreeDrivesPattern(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });
});
