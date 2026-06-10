// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FibCirclesState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { FIB_LEVELS } from "./fibLevels.js";
import { renderFibCircles } from "./fibCircles.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: FibCirclesState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "fib-circles",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderFibCircles", () => {
    it("strokes one full circle per default FIB_LEVELS entry", () => {
        const ctx = new MockCanvas2DContext();
        renderFibCircles(
            ctx,
            emission({
                kind: "fib-circles",
                anchors: [
                    { time: 50, price: 50 },
                    { time: 80, price: 50 },
                ],
                style: {},
            }),
            VIEW,
        );
        const arcs = ctx.calls.filter((c) => c.kind === "arc");
        expect(arcs).toHaveLength(FIB_LEVELS.length);
        // Radii are monotonically increasing with level index (FIB_LEVELS
        // is monotone).
        const radii: number[] = [];
        for (const a of arcs) {
            if (a.kind === "arc") radii.push(a.radius);
        }
        for (let i = 1; i < radii.length; i++) {
            expect(radii[i]).toBeGreaterThanOrEqual(radii[i - 1]);
        }
    });

    it("paints labels when showLabels is true", () => {
        const ctx = new MockCanvas2DContext();
        renderFibCircles(
            ctx,
            emission({
                kind: "fib-circles",
                anchors: [
                    { time: 50, price: 50 },
                    { time: 80, price: 50 },
                ],
                style: { levels: [0.5, 1], showLabels: true },
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(2);
    });

    it("defaults strokeStyle to fib yellow #facc15", () => {
        const ctx = new MockCanvas2DContext();
        renderFibCircles(
            ctx,
            emission({
                kind: "fib-circles",
                anchors: [
                    { time: 50, price: 50 },
                    { time: 80, price: 50 },
                ],
                style: { levels: [0.5] },
            }),
            VIEW,
        );
        const strokeSet = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (strokeSet?.kind === "set") expect(strokeSet.value).toBe("#facc15");
    });

    it("strokes no fills (circles are stroked, not filled)", () => {
        const ctx = new MockCanvas2DContext();
        renderFibCircles(
            ctx,
            emission({
                kind: "fib-circles",
                anchors: [
                    { time: 50, price: 50 },
                    { time: 80, price: 50 },
                ],
                style: { levels: [0.5, 1] },
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });
});
