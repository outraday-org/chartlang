// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { TrendAngleState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderTrendAngle } from "./trendAngle";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: TrendAngleState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "trend-angle",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderTrendAngle", () => {
    it("strokes the main segment, draws an arc and labels the angle in degrees", () => {
        const ctx = new MockCanvas2DContext();
        renderTrendAngle(
            ctx,
            emission({
                kind: "trend-angle",
                // 45° upward-to-the-right segment in world space — since
                // the viewport's price range matches the time range,
                // the projected slope is also screen-space 45°
                // (modulo the canvas y-axis flip).
                anchors: [
                    { time: 0, price: 0 },
                    { time: 50, price: 50 },
                ],
                style: { color: "#22c55e" },
            }),
            VIEW,
        );
        const arc = ctx.calls.find((c) => c.kind === "arc");
        expect(arc).toBeDefined();
        const textCall = ctx.calls.find((c) => c.kind === "fillText");
        expect(textCall).toBeDefined();
        if (textCall !== undefined && textCall.kind === "fillText") {
            expect(textCall.text).toMatch(/^-?\d+(\.\d+)?°$/);
        }
        expect(ctx.calls.some((c) => c.kind === "stroke")).toBe(true);
    });

    it("sets the font for the angle text and the fillStyle to the stroke colour", () => {
        const ctx = new MockCanvas2DContext();
        renderTrendAngle(
            ctx,
            emission({
                kind: "trend-angle",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 0 },
                ],
                style: { color: "#22c55e" },
            }),
            VIEW,
        );
        expect(
            ctx.calls.some(
                (c) => c.kind === "set" && c.prop === "font" && c.value === "12px sans-serif",
            ),
        ).toBe(true);
        expect(
            ctx.calls.some(
                (c) => c.kind === "set" && c.prop === "fillStyle" && c.value === "#22c55e",
            ),
        ).toBe(true);
    });

    it("defaults colour to #000000 when style.color is omitted", () => {
        const ctx = new MockCanvas2DContext();
        renderTrendAngle(
            ctx,
            emission({
                kind: "trend-angle",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 50, price: 50 },
                ],
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#000000" });
    });
});
