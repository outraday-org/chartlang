// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../palette";
import { MockCanvas2DContext } from "../testing";
import type { HLine, Viewport } from "./coords";
import { drawHorizontalLine } from "./horizontalLine";

const viewport: Viewport = {
    xMin: 0,
    xMax: 10,
    yMin: 0,
    yMax: 100,
    pxWidth: 200,
    pxHeight: 100,
};

const baseHLine: HLine = { price: 50, color: "#ff0000", lineWidth: 2, lineStyle: "solid" };

describe("drawHorizontalLine", () => {
    it("emits the canonical strokeStyle / lineWidth / setLineDash / beginPath / moveTo / lineTo / stroke / setLineDash sequence", () => {
        const ctx = new MockCanvas2DContext();
        drawHorizontalLine(ctx, baseHLine, viewport, DEFAULT_PALETTE);
        expect(ctx.calls.map((c) => c.kind)).toEqual([
            "set", // strokeStyle
            "set", // lineWidth
            "setLineDash",
            "beginPath",
            "moveTo",
            "lineTo",
            "stroke",
            "setLineDash",
        ]);
    });

    it("dashed lineStyle emits [6, 4]; dotted emits [2, 4]; solid emits []", () => {
        const dashed = new MockCanvas2DContext();
        drawHorizontalLine(
            dashed,
            { ...baseHLine, lineStyle: "dashed" },
            viewport,
            DEFAULT_PALETTE,
        );
        const dashedSegments = dashed.calls
            .filter((c) => c.kind === "setLineDash")
            .map((c) => c.segments);
        expect(dashedSegments).toEqual([[6, 4], []]);

        const dotted = new MockCanvas2DContext();
        drawHorizontalLine(
            dotted,
            { ...baseHLine, lineStyle: "dotted" },
            viewport,
            DEFAULT_PALETTE,
        );
        const dottedSegments = dotted.calls
            .filter((c) => c.kind === "setLineDash")
            .map((c) => c.segments);
        expect(dottedSegments).toEqual([[2, 4], []]);
    });

    it("falls back to palette.plotDefault when hline.color is null", () => {
        const ctx = new MockCanvas2DContext();
        drawHorizontalLine(ctx, { ...baseHLine, color: null }, viewport, DEFAULT_PALETTE);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        expect(stroke).toEqual({
            kind: "set",
            prop: "strokeStyle",
            value: DEFAULT_PALETTE.plotDefault,
        });
    });

    it("draws across the full canvas width at the mapped y", () => {
        const ctx = new MockCanvas2DContext();
        drawHorizontalLine(ctx, { ...baseHLine, price: 50 }, viewport, DEFAULT_PALETTE);
        const move = ctx.calls.find((c) => c.kind === "moveTo");
        const line = ctx.calls.find((c) => c.kind === "lineTo");
        // priceToY(50) on a [0, 100] viewport with pxHeight=100 lands at y=50
        expect(move).toEqual({ kind: "moveTo", x: 0, y: 50 });
        expect(line).toEqual({ kind: "lineTo", x: 200, y: 50 });
    });
});
