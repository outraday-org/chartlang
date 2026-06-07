// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { ArrowMarkerState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderArrowMarker } from "./arrowMarker";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: ArrowMarkerState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "arrow-marker",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const BASIC_STATE: ArrowMarkerState = {
    kind: "arrow-marker",
    anchor: { time: 50, price: 50 },
    style: {},
};

describe("renderArrowMarker", () => {
    it("paints a dot (arc + fill) + a stub line (stroke) + an arrowhead (fill)", () => {
        const ctx = new MockCanvas2DContext();
        renderArrowMarker(ctx, emission(BASIC_STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "arc")).toHaveLength(1);
        // 1 fill for the dot + 1 fill for the arrowhead = 2 fills.
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(2);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
    });

    it("defaults to invinite toolbar blue (#3b82f6) when style.color is omitted", () => {
        const ctx = new MockCanvas2DContext();
        renderArrowMarker(ctx, emission(BASIC_STATE), VIEW);
        const fillStyleCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        const strokeStyleCall = ctx.calls.find(
            (c) => c.kind === "set" && c.prop === "strokeStyle",
        );
        if (fillStyleCall?.kind === "set") expect(fillStyleCall.value).toBe("#3b82f6");
        if (strokeStyleCall?.kind === "set") expect(strokeStyleCall.value).toBe("#3b82f6");
    });

    it("honours an explicit style.color override", () => {
        const ctx = new MockCanvas2DContext();
        renderArrowMarker(
            ctx,
            emission({ ...BASIC_STATE, style: { color: "#10b981" } }),
            VIEW,
        );
        const fillStyleCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        if (fillStyleCall?.kind === "set") expect(fillStyleCall.value).toBe("#10b981");
    });

    it("issues no fillText call when style.text is undefined", () => {
        const ctx = new MockCanvas2DContext();
        renderArrowMarker(ctx, emission(BASIC_STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(0);
    });

    it("paints the optional text to the right of the anchor with left/middle alignment", () => {
        const ctx = new MockCanvas2DContext();
        renderArrowMarker(
            ctx,
            emission({ ...BASIC_STATE, style: { text: "Long" } }),
            VIEW,
        );
        const textCall = ctx.calls.find((c) => c.kind === "fillText");
        expect(textCall).toBeDefined();
        if (textCall?.kind === "fillText") expect(textCall.text).toBe("Long");
        const textCallIdx = ctx.calls.findIndex((c) => c.kind === "fillText");
        const alignBefore = ctx.calls
            .slice(0, textCallIdx)
            .reverse()
            .find((c) => c.kind === "set" && c.prop === "textAlign");
        const baselineBefore = ctx.calls
            .slice(0, textCallIdx)
            .reverse()
            .find((c) => c.kind === "set" && c.prop === "textBaseline");
        if (alignBefore?.kind === "set") expect(alignBefore.value).toBe("left");
        if (baselineBefore?.kind === "set") expect(baselineBefore.value).toBe("middle");
    });

    it("dot arc spans a full circle (0 to 2π)", () => {
        const ctx = new MockCanvas2DContext();
        renderArrowMarker(ctx, emission(BASIC_STATE), VIEW);
        const arcCall = ctx.calls.find((c) => c.kind === "arc");
        if (arcCall?.kind === "arc") {
            expect(arcCall.start).toBe(0);
            expect(arcCall.end).toBeCloseTo(Math.PI * 2);
        }
    });
});
