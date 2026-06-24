// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../palette.js";
import { MockCanvas2DContext } from "../testing.js";
import { type PlotPoint, type Viewport, timeToX } from "./coords.js";
import { drawLine } from "./line.js";

const viewport: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 100,
    pxHeight: 100,
};

// Five evenly spaced bars whose times equal the unshifted point times, so
// a no-shift `drawLine` reproduces the pre-feature `timeToX(point.time)` x.
const BARS = [{ time: 0 }, { time: 25 }, { time: 50 }, { time: 75 }, { time: 100 }];
const SPACING = 25;
const world = { bars: BARS, spacing: SPACING };

// `z` / `seq` are render-pass sort keys the adapter assigns at ingest;
// the pure `drawLine` renderer ignores them. Default both to `0` here so
// the renderer unit tests stay focused on geometry, not layering.
function point(
    p: Omit<PlotPoint, "bar" | "z" | "seq"> & { bar: number; z?: number; seq?: number },
): PlotPoint {
    return { z: 0, seq: 0, ...p };
}

describe("drawLine", () => {
    it("returns early on empty series", () => {
        const ctx = new MockCanvas2DContext();
        drawLine(ctx, [], world, viewport, DEFAULT_PALETTE, 1);
        expect(ctx.calls).toEqual([]);
    });

    it("returns early when every point is null / non-finite", () => {
        const ctx = new MockCanvas2DContext();
        drawLine(
            ctx,
            [
                point({ time: 0, value: null, color: null, bar: 0 }),
                point({ time: 25, value: Number.NaN, color: null, bar: 1 }),
                point({ time: 50, value: Number.POSITIVE_INFINITY, color: null, bar: 2 }),
            ],
            world,
            viewport,
            DEFAULT_PALETTE,
            1,
        );
        expect(ctx.calls).toEqual([]);
    });

    it("emits 1 beginPath / 1 moveTo / N-1 lineTo / 1 stroke for an N-point all-finite series", () => {
        const ctx = new MockCanvas2DContext();
        const series: PlotPoint[] = [
            point({ time: 0, value: 10, color: null, bar: 0 }),
            point({ time: 25, value: 20, color: null, bar: 1 }),
            point({ time: 50, value: 30, color: null, bar: 2 }),
            point({ time: 75, value: 20, color: null, bar: 3 }),
            point({ time: 100, value: 10, color: null, bar: 4 }),
        ];
        drawLine(ctx, series, world, viewport, DEFAULT_PALETTE, 1);
        const beginPaths = ctx.calls.filter((c) => c.kind === "beginPath").length;
        const moveTos = ctx.calls.filter((c) => c.kind === "moveTo").length;
        const lineTos = ctx.calls.filter((c) => c.kind === "lineTo").length;
        const strokes = ctx.calls.filter((c) => c.kind === "stroke").length;
        expect(beginPaths).toBe(1);
        expect(moveTos).toBe(1);
        expect(lineTos).toBe(series.length - 1);
        expect(strokes).toBe(1);
    });

    it("applies the given line width with round joins/caps", () => {
        const ctx = new MockCanvas2DContext();
        drawLine(
            ctx,
            [
                point({ time: 0, value: 10, color: null, bar: 0 }),
                point({ time: 25, value: 20, color: null, bar: 1 }),
            ],
            world,
            viewport,
            DEFAULT_PALETTE,
            2,
        );
        expect(ctx.calls).toContainEqual({ kind: "set", prop: "lineWidth", value: 2 });
        expect(ctx.calls).toContainEqual({ kind: "set", prop: "lineJoin", value: "round" });
        expect(ctx.calls).toContainEqual({ kind: "set", prop: "lineCap", value: "round" });
    });

    it("breaks the line into sub-paths on null / non-finite gaps", () => {
        const ctx = new MockCanvas2DContext();
        const series: PlotPoint[] = [
            point({ time: 0, value: 10, color: null, bar: 0 }),
            point({ time: 25, value: 20, color: null, bar: 1 }),
            point({ time: 50, value: null, color: null, bar: 2 }),
            point({ time: 75, value: 30, color: null, bar: 3 }),
            point({ time: 100, value: Number.NaN, color: null, bar: 4 }),
            point({ time: 100, value: 40, color: null, bar: 4 }),
        ];
        drawLine(ctx, series, world, viewport, DEFAULT_PALETTE, 1);
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
                point({ time: 0, value: null, color: "#abcdef", bar: 0 }),
                point({ time: 25, value: 10, color: "#123456", bar: 1 }),
                point({ time: 50, value: 20, color: null, bar: 2 }),
            ],
            world,
            viewport,
            DEFAULT_PALETTE,
            1,
        );
        const setStrokeA = ctxA.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        expect(setStrokeA).toEqual({ kind: "set", prop: "strokeStyle", value: "#123456" });

        const ctxB = new MockCanvas2DContext();
        drawLine(
            ctxB,
            [
                point({ time: 0, value: 10, color: null, bar: 0 }),
                point({ time: 25, value: 20, color: null, bar: 1 }),
            ],
            world,
            viewport,
            DEFAULT_PALETTE,
            1,
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
                point({ time: 0, value: null, color: null, bar: 0 }),
                point({ time: 25, value: null, color: null, bar: 1 }),
            ],
            world,
            viewport,
            DEFAULT_PALETTE,
            1,
        );
        expect(ctx.calls.filter((c) => c.kind === "stroke").length).toBe(0);
    });

    it("no-shift / omitted xShift draws at the bar's own x (byte-identical to timeToX)", () => {
        const ctx = new MockCanvas2DContext();
        drawLine(
            ctx,
            [point({ time: 50, value: 40, color: null, bar: 2 })],
            world,
            viewport,
            DEFAULT_PALETTE,
            1,
        );
        const move = ctx.calls.find((c) => c.kind === "moveTo");
        expect(move).toEqual({ kind: "moveTo", x: timeToX(50, viewport), y: 60 });
    });

    it("a negative xShift draws the point k bars left", () => {
        const ctx = new MockCanvas2DContext();
        // bar 3 (time 75) shifted two left → bar 1's x (time 25 → x 25).
        drawLine(
            ctx,
            [point({ time: 75, value: 40, color: null, bar: 3, xShift: -2 })],
            world,
            viewport,
            DEFAULT_PALETTE,
            1,
        );
        const move = ctx.calls.find((c) => c.kind === "moveTo");
        expect(move).toEqual({ kind: "moveTo", x: timeToX(25, viewport), y: 60 });
    });

    it("a positive xShift draws the point k bars right", () => {
        const ctx = new MockCanvas2DContext();
        // bar 1 (time 25) shifted two right → bar 3's x (time 75 → x 75).
        drawLine(
            ctx,
            [point({ time: 25, value: 40, color: null, bar: 1, xShift: 2 })],
            world,
            viewport,
            DEFAULT_PALETTE,
            1,
        );
        const move = ctx.calls.find((c) => c.kind === "moveTo");
        expect(move).toEqual({ kind: "moveTo", x: timeToX(75, viewport), y: 60 });
    });
});
