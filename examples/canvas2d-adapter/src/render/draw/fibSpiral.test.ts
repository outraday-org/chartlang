// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FibSpiralState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderFibSpiral } from "./fibSpiral";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: FibSpiralState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "fib-spiral",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderFibSpiral", () => {
    it("strokes a single chained polyline (1 stroke, many lineTos)", () => {
        const ctx = new MockCanvas2DContext();
        renderFibSpiral(
            ctx,
            emission({
                kind: "fib-spiral",
                anchors: [
                    { time: 50, price: 50 },
                    { time: 80, price: 50 },
                ],
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        // 8 quarters × 16 samples per quarter (skipping each quarter's
        // first point) = 128 lineTo segments.
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(8 * 16);
    });

    it("returns early when the anchors collapse (zero radius)", () => {
        const ctx = new MockCanvas2DContext();
        renderFibSpiral(
            ctx,
            emission({
                kind: "fib-spiral",
                anchors: [
                    { time: 50, price: 50 },
                    { time: 50, price: 50 },
                ],
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls).toEqual([]);
    });

    it("defaults strokeStyle to fib yellow #facc15", () => {
        const ctx = new MockCanvas2DContext();
        renderFibSpiral(
            ctx,
            emission({
                kind: "fib-spiral",
                anchors: [
                    { time: 50, price: 50 },
                    { time: 80, price: 50 },
                ],
                style: {},
            }),
            VIEW,
        );
        const strokeSet = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (strokeSet?.kind === "set") expect(strokeSet.value).toBe("#facc15");
    });

    it("honours custom colour", () => {
        const ctx = new MockCanvas2DContext();
        renderFibSpiral(
            ctx,
            emission({
                kind: "fib-spiral",
                anchors: [
                    { time: 50, price: 50 },
                    { time: 80, price: 50 },
                ],
                style: { color: "#3b82f6" },
            }),
            VIEW,
        );
        const strokeSet = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (strokeSet?.kind === "set") expect(strokeSet.value).toBe("#3b82f6");
    });
});
