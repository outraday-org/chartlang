// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FrameState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { renderFrame } from "./frame.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: FrameState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "frame",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const BARE_STATE: FrameState = {
    kind: "frame",
    anchors: [
        { time: 10, price: 20 },
        { time: 60, price: 70 },
    ],
    childHandleIds: [],
    style: {},
};

describe("renderFrame", () => {
    it("strokes a closed 4-corner rectangle with the default slate stroke", () => {
        const ctx = new MockCanvas2DContext();
        renderFrame(ctx, emission(BARE_STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "beginPath")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(3);
        expect(ctx.calls.filter((c) => c.kind === "closePath")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#64748b");
    });

    it("paints the background via fillRect when style.bgColor is set", () => {
        const ctx = new MockCanvas2DContext();
        renderFrame(ctx, emission({ ...BARE_STATE, style: { bgColor: "#f1f5f9" } }), VIEW);
        const fills = ctx.calls.filter((c) => c.kind === "fillRect");
        expect(fills).toHaveLength(1);
        const fillStyle = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        if (fillStyle?.kind === "set") expect(fillStyle.value).toBe("#f1f5f9");
    });

    it("does not paint a background when style.bgColor is unset", () => {
        const ctx = new MockCanvas2DContext();
        renderFrame(ctx, emission(BARE_STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "fillRect")).toHaveLength(0);
    });

    it("paints a fillText label at the top-left when style.label is set", () => {
        const ctx = new MockCanvas2DContext();
        renderFrame(ctx, emission({ ...BARE_STATE, style: { label: "Idea" } }), VIEW);
        const texts = ctx.calls.filter((c) => c.kind === "fillText");
        expect(texts).toHaveLength(1);
        if (texts[0].kind === "fillText") expect(texts[0].text).toBe("Idea");
    });

    it("does not paint label text when style.label is unset", () => {
        const ctx = new MockCanvas2DContext();
        renderFrame(ctx, emission(BARE_STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(0);
    });

    it("no-ops silently on degenerate zero-width anchors", () => {
        const ctx = new MockCanvas2DContext();
        renderFrame(
            ctx,
            emission({
                ...BARE_STATE,
                anchors: [
                    { time: 50, price: 20 },
                    { time: 50, price: 70 },
                ],
            }),
            VIEW,
        );
        expect(ctx.calls).toEqual([]);
    });

    it("no-ops silently on degenerate zero-height anchors", () => {
        const ctx = new MockCanvas2DContext();
        renderFrame(
            ctx,
            emission({
                ...BARE_STATE,
                anchors: [
                    { time: 10, price: 50 },
                    { time: 60, price: 50 },
                ],
            }),
            VIEW,
        );
        expect(ctx.calls).toEqual([]);
    });

    it("no-ops silently when projected coordinates are non-finite", () => {
        // A zero-span viewport in y produces a divide-by-zero on
        // priceToY for the price = 0 anchor, so the projected y is
        // -Infinity. The renderer guards Number.isFinite on width +
        // height; the height edge here is infinite so the renderer
        // skips silently.
        const ctx = new MockCanvas2DContext();
        renderFrame(ctx, emission(BARE_STATE), { ...VIEW, yMin: 50, yMax: 50 });
        expect(ctx.calls).toEqual([]);
    });
});
