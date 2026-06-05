// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../palette";
import { MockCanvas2DContext } from "../testing";
import { drawArea } from "./area";

const POINTS = [
    { x: 0, y: 50 },
    { x: 10, y: 40 },
    { x: 20, y: 45 },
];

describe("drawArea", () => {
    it("returns early when given fewer than 2 points", () => {
        const ctxEmpty = new MockCanvas2DContext();
        drawArea(
            ctxEmpty,
            {
                points: [],
                lineWidth: 1,
                lineStyle: "solid",
                color: null,
                fillAlpha: 0.2,
                baselineY: 100,
            },
            DEFAULT_PALETTE,
        );
        expect(ctxEmpty.calls).toEqual([]);

        const ctxOne = new MockCanvas2DContext();
        drawArea(
            ctxOne,
            {
                points: [{ x: 0, y: 50 }],
                lineWidth: 1,
                lineStyle: "solid",
                color: null,
                fillAlpha: 0.2,
                baselineY: 100,
            },
            DEFAULT_PALETTE,
        );
        expect(ctxOne.calls).toEqual([]);
    });

    it("issues the canonical fill-then-stroke sequence for an N-point polyline", () => {
        const ctx = new MockCanvas2DContext();
        drawArea(
            ctx,
            {
                points: POINTS,
                lineWidth: 2,
                lineStyle: "solid",
                color: "#26a69a",
                fillAlpha: 0.2,
                baselineY: 100,
            },
            DEFAULT_PALETTE,
        );
        expect(ctx.calls.map((c) => c.kind)).toEqual([
            "set", // fillStyle
            "set", // globalAlpha → fillAlpha
            "beginPath",
            "moveTo", // first.x, baselineY
            "lineTo", // point 0
            "lineTo", // point 1
            "lineTo", // point 2
            "lineTo", // last.x, baselineY
            "closePath",
            "fill",
            "set", // globalAlpha → 1 reset
            "set", // strokeStyle
            "set", // lineWidth
            "setLineDash", // []
            "beginPath",
            "moveTo", // first
            "lineTo", // point 1
            "lineTo", // point 2
            "stroke",
            "setLineDash", // [] reset
        ]);
    });

    it("uses fillAlpha for the fill and resets globalAlpha to 1 before the stroke", () => {
        const ctx = new MockCanvas2DContext();
        drawArea(
            ctx,
            {
                points: POINTS,
                lineWidth: 1,
                lineStyle: "solid",
                color: "#26a69a",
                fillAlpha: 0.3,
                baselineY: 100,
            },
            DEFAULT_PALETTE,
        );
        const alphas = ctx.calls.filter((c) => c.kind === "set" && c.prop === "globalAlpha");
        expect(alphas).toEqual([
            { kind: "set", prop: "globalAlpha", value: 0.3 },
            { kind: "set", prop: "globalAlpha", value: 1 },
        ]);
    });

    it("dashed lineStyle emits [6, 4] then restores []; dotted emits [2, 4]", () => {
        const dashed = new MockCanvas2DContext();
        drawArea(
            dashed,
            {
                points: POINTS,
                lineWidth: 1,
                lineStyle: "dashed",
                color: "#000",
                fillAlpha: 0.2,
                baselineY: 100,
            },
            DEFAULT_PALETTE,
        );
        const dashedSegments = dashed.calls
            .filter((c) => c.kind === "setLineDash")
            .map((c) => c.segments);
        expect(dashedSegments).toEqual([[6, 4], []]);

        const dotted = new MockCanvas2DContext();
        drawArea(
            dotted,
            {
                points: POINTS,
                lineWidth: 1,
                lineStyle: "dotted",
                color: "#000",
                fillAlpha: 0.2,
                baselineY: 100,
            },
            DEFAULT_PALETTE,
        );
        const dottedSegments = dotted.calls
            .filter((c) => c.kind === "setLineDash")
            .map((c) => c.segments);
        expect(dottedSegments).toEqual([[2, 4], []]);
    });

    it("uses palette.plotDefault when color is null (applies to both fill and stroke)", () => {
        const ctx = new MockCanvas2DContext();
        drawArea(
            ctx,
            {
                points: POINTS,
                lineWidth: 1,
                lineStyle: "solid",
                color: null,
                fillAlpha: 0.2,
                baselineY: 100,
            },
            DEFAULT_PALETTE,
        );
        const fill = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        expect(fill).toEqual({
            kind: "set",
            prop: "fillStyle",
            value: DEFAULT_PALETTE.plotDefault,
        });
        expect(stroke).toEqual({
            kind: "set",
            prop: "strokeStyle",
            value: DEFAULT_PALETTE.plotDefault,
        });
    });
});
