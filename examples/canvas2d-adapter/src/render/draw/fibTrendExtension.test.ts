// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FibTrendExtensionState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { FIB_LEVELS } from "./fibLevels.js";
import { renderFibTrendExtension } from "./fibTrendExtension.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: FibTrendExtensionState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "fib-trend-extension",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderFibTrendExtension", () => {
    it("strokes one horizontal projection per default FIB_LEVELS entry", () => {
        const ctx = new MockCanvas2DContext();
        renderFibTrendExtension(
            ctx,
            emission({
                kind: "fib-trend-extension",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 50, price: 100 },
                    { time: 100, price: 50 },
                ],
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(FIB_LEVELS.length);
    });

    it("projects each rail rightward to the viewport edge", () => {
        const ctx = new MockCanvas2DContext();
        renderFibTrendExtension(
            ctx,
            emission({
                kind: "fib-trend-extension",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 50, price: 100 },
                    { time: 25, price: 50 },
                ],
                style: { levels: [0.5] },
            }),
            VIEW,
        );
        const moves = ctx.calls.filter((c) => c.kind === "moveTo" || c.kind === "lineTo");
        if (moves[1].kind === "lineTo") expect(moves[1].x).toBe(VIEW.pxWidth);
    });

    it("paints one fillText label per level when showLabels is true", () => {
        const ctx = new MockCanvas2DContext();
        renderFibTrendExtension(
            ctx,
            emission({
                kind: "fib-trend-extension",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 50, price: 100 },
                    { time: 25, price: 50 },
                ],
                style: { levels: [0.382, 0.618], showLabels: true },
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(2);
    });

    it("honours an explicit style.color override", () => {
        const ctx = new MockCanvas2DContext();
        renderFibTrendExtension(
            ctx,
            emission({
                kind: "fib-trend-extension",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 50, price: 100 },
                    { time: 25, price: 50 },
                ],
                style: { levels: [0.5], color: "#10b981" },
            }),
            VIEW,
        );
        const strokeSet = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (strokeSet?.kind === "set") expect(strokeSet.value).toBe("#10b981");
    });
});
