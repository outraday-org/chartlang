// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FibSpeedArcsState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { FIB_LEVELS } from "./fibLevels.js";
import { renderFibSpeedArcs } from "./fibSpeedArcs.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: FibSpeedArcsState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "fib-speed-arcs",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderFibSpeedArcs", () => {
    it("strokes one full circle per default FIB_LEVELS entry", () => {
        const ctx = new MockCanvas2DContext();
        renderFibSpeedArcs(
            ctx,
            emission({
                kind: "fib-speed-arcs",
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
        for (const a of arcs) {
            if (a.kind === "arc") {
                expect(a.start).toBe(0);
                expect(a.end).toBeCloseTo(Math.PI * 2);
            }
        }
    });

    it("strokes a 3-level set with 3 arcs", () => {
        const ctx = new MockCanvas2DContext();
        renderFibSpeedArcs(
            ctx,
            emission({
                kind: "fib-speed-arcs",
                anchors: [
                    { time: 50, price: 50 },
                    { time: 80, price: 50 },
                ],
                style: { levels: [0.382, 0.5, 0.618] },
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "arc")).toHaveLength(3);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });

    it("paints labels when showLabels is true", () => {
        const ctx = new MockCanvas2DContext();
        renderFibSpeedArcs(
            ctx,
            emission({
                kind: "fib-speed-arcs",
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
        renderFibSpeedArcs(
            ctx,
            emission({
                kind: "fib-speed-arcs",
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
});
