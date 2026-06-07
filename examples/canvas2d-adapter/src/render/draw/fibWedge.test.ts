// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FibWedgeState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { FIB_LEVELS } from "./fibLevels";
import { renderFibWedge } from "./fibWedge";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: FibWedgeState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "fib-wedge",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderFibWedge", () => {
    it("strokes one ray per default FIB_LEVELS entry", () => {
        const ctx = new MockCanvas2DContext();
        renderFibWedge(
            ctx,
            emission({
                kind: "fib-wedge",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                    { time: 100, price: -100 },
                ],
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(FIB_LEVELS.length);
    });

    it("starts every ray at the pivot anchor", () => {
        const ctx = new MockCanvas2DContext();
        renderFibWedge(
            ctx,
            emission({
                kind: "fib-wedge",
                anchors: [
                    { time: 25, price: 0 },
                    { time: 75, price: 50 },
                    { time: 75, price: -50 },
                ],
                style: { levels: [0, 0.5, 1] },
            }),
            VIEW,
        );
        const moves = ctx.calls.filter((c) => c.kind === "moveTo");
        // All 3 strokes start at the same pivot
        const xs = new Set(moves.map((c) => (c.kind === "moveTo" ? c.x : 0)));
        const ys = new Set(moves.map((c) => (c.kind === "moveTo" ? c.y : 0)));
        expect(xs.size).toBe(1);
        expect(ys.size).toBe(1);
    });

    it("skips a level whose direction degenerates to a zero vector", () => {
        const ctx = new MockCanvas2DContext();
        renderFibWedge(
            ctx,
            emission({
                kind: "fib-wedge",
                anchors: [
                    { time: 50, price: 50 },
                    { time: 50, price: 50 },
                    { time: 50, price: 50 },
                ],
                style: { levels: [0.5] },
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(0);
    });

    it("paints one fillText label per non-degenerate level when showLabels is true", () => {
        const ctx = new MockCanvas2DContext();
        renderFibWedge(
            ctx,
            emission({
                kind: "fib-wedge",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                    { time: 100, price: -100 },
                ],
                style: { levels: [0.382, 0.618], showLabels: true },
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(2);
    });
});
