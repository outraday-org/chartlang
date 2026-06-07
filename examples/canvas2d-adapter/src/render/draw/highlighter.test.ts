// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { HighlighterState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderHighlighter } from "./highlighter";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: HighlighterState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "highlighter",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const HIGHLIGHTER_STATE: HighlighterState = {
    kind: "highlighter",
    anchors: [
        { time: 0, price: 0 },
        { time: 50, price: 50 },
    ],
    style: { color: "#facc15", alpha: 0.3 },
};

describe("renderHighlighter", () => {
    it("wraps the stroke in a globalAlpha set/reset bracket", () => {
        const ctx = new MockCanvas2DContext();
        renderHighlighter(ctx, emission(HIGHLIGHTER_STATE), VIEW);
        const alphaCalls = ctx.calls.filter(
            (c) => c.kind === "set" && c.prop === "globalAlpha",
        );
        expect(alphaCalls).toHaveLength(2);
        // First sets to the style alpha; second resets to 1.
        if (alphaCalls[0].kind === "set") expect(alphaCalls[0].value).toBe(0.3);
        if (alphaCalls[1].kind === "set") expect(alphaCalls[1].value).toBe(1);
    });

    it("strokes the polyline once with the required color", () => {
        const ctx = new MockCanvas2DContext();
        renderHighlighter(ctx, emission(HIGHLIGHTER_STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#facc15" });
    });

    it("does NOT issue closePath / fill (highlighter is stroke-only)", () => {
        const ctx = new MockCanvas2DContext();
        renderHighlighter(ctx, emission(HIGHLIGHTER_STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "closePath")).toHaveLength(0);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });
});
