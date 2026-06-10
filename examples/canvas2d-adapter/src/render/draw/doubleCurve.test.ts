// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { DoubleCurveState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { renderDoubleCurve } from "./doubleCurve.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: DoubleCurveState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "double-curve",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const DOUBLE_CURVE_STATE: DoubleCurveState = {
    kind: "double-curve",
    anchors: [
        { time: 0, price: 0 },
        { time: 25, price: 25 },
        { time: 50, price: 0 },
        { time: 75, price: -25 },
        { time: 100, price: 0 },
    ],
    style: { color: "#a855f7" },
};

describe("renderDoubleCurve", () => {
    it("samples the cubic Bezier as a 32-segment polyline (33 points → 1 moveTo + 32 lineTo)", () => {
        const ctx = new MockCanvas2DContext();
        renderDoubleCurve(ctx, emission(DOUBLE_CURVE_STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "moveTo")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(32);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
    });

    it("defaults stroke / lineWidth when style omits them", () => {
        const ctx = new MockCanvas2DContext();
        renderDoubleCurve(ctx, emission({ ...DOUBLE_CURVE_STATE, style: {} }), VIEW);
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#000000" });
        expect(ctx.calls[1]).toEqual({ kind: "set", prop: "lineWidth", value: 1 });
    });

    it("first moveTo matches projected P0 and last lineTo matches projected P4", () => {
        const ctx = new MockCanvas2DContext();
        renderDoubleCurve(ctx, emission(DOUBLE_CURVE_STATE), VIEW);
        const move = ctx.calls.find((c) => c.kind === "moveTo");
        const lineTos = ctx.calls.filter((c) => c.kind === "lineTo");
        const last = lineTos[lineTos.length - 1];
        // P0=(0,0) → (0,400); P4=(100,0) → (800,400).
        if (move !== undefined && move.kind === "moveTo") {
            expect(move.x).toBeCloseTo(0, 5);
            expect(move.y).toBeCloseTo(400, 5);
        }
        if (last !== undefined && last.kind === "lineTo") {
            expect(last.x).toBeCloseTo(800, 5);
            expect(last.y).toBeCloseTo(400, 5);
        }
    });
});
