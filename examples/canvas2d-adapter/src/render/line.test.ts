// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../palette.js";
import { MockCanvas2DContext } from "../testing.js";
import type { Viewport } from "./coords.js";
import { drawLine } from "./line.js";

const viewport: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 100,
    pxHeight: 100,
};

describe("drawLine", () => {
    it("returns early on empty series", () => {
        const ctx = new MockCanvas2DContext();
        drawLine(ctx, [], viewport, DEFAULT_PALETTE);
        expect(ctx.calls).toEqual([]);
    });

    it("returns early when every point is null / non-finite", () => {
        const ctx = new MockCanvas2DContext();
        drawLine(
            ctx,
            [
                { time: 0, value: null, color: null },
                { time: 1, value: Number.NaN, color: null },
                { time: 2, value: Number.POSITIVE_INFINITY, color: null },
            ],
            viewport,
            DEFAULT_PALETTE,
        );
        expect(ctx.calls).toEqual([]);
    });

    it("emits 1 beginPath / 1 moveTo / N-1 lineTo / 1 stroke for an N-point all-finite series", () => {
        const ctx = new MockCanvas2DContext();
        const series = [
            { time: 0, value: 10, color: null },
            { time: 25, value: 20, color: null },
            { time: 50, value: 30, color: null },
            { time: 75, value: 20, color: null },
            { time: 100, value: 10, color: null },
        ];
        drawLine(ctx, series, viewport, DEFAULT_PALETTE);
        const beginPaths = ctx.calls.filter((c) => c.kind === "beginPath").length;
        const moveTos = ctx.calls.filter((c) => c.kind === "moveTo").length;
        const lineTos = ctx.calls.filter((c) => c.kind === "lineTo").length;
        const strokes = ctx.calls.filter((c) => c.kind === "stroke").length;
        expect(beginPaths).toBe(1);
        expect(moveTos).toBe(1);
        expect(lineTos).toBe(series.length - 1);
        expect(strokes).toBe(1);
    });

    it("breaks the line into sub-paths on null / non-finite gaps", () => {
        const ctx = new MockCanvas2DContext();
        const series = [
            { time: 0, value: 10, color: null },
            { time: 1, value: 20, color: null },
            { time: 2, value: null, color: null },
            { time: 3, value: 30, color: null },
            { time: 4, value: Number.NaN, color: null },
            { time: 5, value: 40, color: null },
        ];
        drawLine(ctx, series, viewport, DEFAULT_PALETTE);
        const beginPaths = ctx.calls.filter((c) => c.kind === "beginPath").length;
        const strokes = ctx.calls.filter((c) => c.kind === "stroke").length;
        expect(beginPaths).toBe(3);
        expect(strokes).toBe(3);
    });

    it("uses the first finite point's color as strokeStyle, falls back to palette.plotDefault when null", () => {
        const ctxA = new MockCanvas2DContext();
        drawLine(
            ctxA,
            [
                { time: 0, value: null, color: "#abcdef" },
                { time: 1, value: 10, color: "#123456" },
                { time: 2, value: 20, color: null },
            ],
            viewport,
            DEFAULT_PALETTE,
        );
        const setStrokeA = ctxA.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        expect(setStrokeA).toEqual({ kind: "set", prop: "strokeStyle", value: "#123456" });

        const ctxB = new MockCanvas2DContext();
        drawLine(
            ctxB,
            [
                { time: 0, value: 10, color: null },
                { time: 1, value: 20, color: null },
            ],
            viewport,
            DEFAULT_PALETTE,
        );
        const setStrokeB = ctxB.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        expect(setStrokeB).toEqual({
            kind: "set",
            prop: "strokeStyle",
            value: DEFAULT_PALETTE.plotDefault,
        });
    });

    it("does not emit a stroke when the only finite point is preceded by a gap that flushes nothing", () => {
        const ctx = new MockCanvas2DContext();
        drawLine(
            ctx,
            [
                { time: 0, value: null, color: null },
                { time: 1, value: null, color: null },
            ],
            viewport,
            DEFAULT_PALETTE,
        );
        expect(ctx.calls.filter((c) => c.kind === "stroke").length).toBe(0);
    });
});
