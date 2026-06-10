// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { CurveState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { renderCurve } from "./curve.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: CurveState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "curve",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const CURVE_STATE: CurveState = {
    kind: "curve",
    anchors: [
        { time: 0, price: 0 },
        { time: 50, price: 50 },
        { time: 100, price: 0 },
    ],
    style: { color: "#22c55e" },
};

describe("renderCurve", () => {
    it("samples the curve as a 32-segment polyline (33 points → 1 moveTo + 32 lineTo)", () => {
        const ctx = new MockCanvas2DContext();
        renderCurve(ctx, emission(CURVE_STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "moveTo")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(32);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
    });

    it("defaults stroke / lineWidth / lineStyle when omitted", () => {
        const ctx = new MockCanvas2DContext();
        renderCurve(ctx, emission({ ...CURVE_STATE, style: {} }), VIEW);
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#000000" });
        expect(ctx.calls[1]).toEqual({ kind: "set", prop: "lineWidth", value: 1 });
    });

    it("uses the middle anchor as Bezier control directly (does NOT pass through it at t=0.5)", () => {
        // For curve, anchors[1] IS the control point. At t=0.5 the curve
        // value is 0.25*from + 0.5*control + 0.25*to — NOT control.
        const ctx = new MockCanvas2DContext();
        renderCurve(ctx, emission(CURVE_STATE), VIEW);
        // Pick the middle sample (index 16 of 0..32). Compare against
        // the analytic quadratic Bezier value, not the middle anchor.
        // anchors = [(0,0), (50,50), (100,0)] in world; projected to
        // (0,400), (400,200), (800,400) in canvas px. At t=0.5:
        //   x = 0.25*0 + 0.5*400 + 0.25*800 = 400
        //   y = 0.25*400 + 0.5*200 + 0.25*400 = 300
        const lineTos = ctx.calls.filter((c) => c.kind === "lineTo");
        const sample16 = lineTos[15]; // index 16 of 33 total samples (0..32) → lineTos[15] for sample[16].
        expect(sample16).toBeDefined();
        if (sample16 !== undefined && sample16.kind === "lineTo") {
            expect(sample16.x).toBeCloseTo(400, 5);
            expect(sample16.y).toBeCloseTo(300, 5);
        }
    });
});
