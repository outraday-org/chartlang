// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { RegressionTrendState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderRegressionTrend } from "./regressionTrend";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: RegressionTrendState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "regression-trend",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderRegressionTrend", () => {
    it("strokes the placeholder anchor-to-anchor line", () => {
        const ctx = new MockCanvas2DContext();
        renderRegressionTrend(
            ctx,
            emission({
                kind: "regression-trend",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                ],
                style: { source: "close", stdevMultiplier: 2 },
            }),
            VIEW,
        );
        const sequence = ctx.calls.map((c) => c.kind);
        expect(sequence).toEqual([
            "set",
            "set",
            "setLineDash",
            "beginPath",
            "moveTo",
            "lineTo",
            "stroke",
            "setLineDash",
        ]);
        const moves = ctx.calls.filter((c) => c.kind === "moveTo" || c.kind === "lineTo");
        expect(moves[0]).toMatchObject({ kind: "moveTo", x: 0, y: 400 });
        expect(moves[1]).toMatchObject({ kind: "lineTo", x: 800, y: 0 });
    });

    it("defaults strokeStyle to invinite toolbar blue #3b82f6", () => {
        const ctx = new MockCanvas2DContext();
        renderRegressionTrend(
            ctx,
            emission({
                kind: "regression-trend",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                ],
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#3b82f6" });
    });

    it("honours an explicit style.color override", () => {
        const ctx = new MockCanvas2DContext();
        renderRegressionTrend(
            ctx,
            emission({
                kind: "regression-trend",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                ],
                style: { color: "#10b981" },
            }),
            VIEW,
        );
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#10b981" });
    });

    it("does not render bands even when showUpperBand / showLowerBand are set (placeholder renderer)", () => {
        const ctx = new MockCanvas2DContext();
        renderRegressionTrend(
            ctx,
            emission({
                kind: "regression-trend",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                ],
                style: { showUpperBand: true, showLowerBand: true, stdevMultiplier: 2 },
            }),
            VIEW,
        );
        // Single stroke pair — the bands are deferred (see plan §3).
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
    });
});
