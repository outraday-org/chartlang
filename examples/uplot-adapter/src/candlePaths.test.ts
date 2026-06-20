// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { MockCanvasContext } from "@invinite-org/chartlang-adapter-kit/canvas";
import { describe, expect, it } from "vitest";

import { type CandlePathStyle, type ProjectedCandle, drawCandlePaths } from "./candlePaths.js";

const STYLE: CandlePathStyle = { bodyWidth: 6, bull: "#26a69a", bear: "#ef5350" };

describe("drawCandlePaths", () => {
    it("paints a bull candle (close above open) in the bull colour", () => {
        const ctx = new MockCanvasContext();
        // Smaller y is higher price, so closeY < openY ⇒ bull.
        const candle: ProjectedCandle = { x: 50, openY: 80, closeY: 40, highY: 20, lowY: 100 };
        drawCandlePaths(ctx, [candle], STYLE);
        // wick: strokeStyle set, beginPath, moveTo high, lineTo low, stroke
        expect(ctx.calls).toEqual([
            { kind: "set", prop: "strokeStyle", value: "#26a69a" },
            { kind: "beginPath" },
            { kind: "moveTo", x: 50, y: 20 },
            { kind: "lineTo", x: 50, y: 100 },
            { kind: "stroke" },
            { kind: "set", prop: "fillStyle", value: "#26a69a" },
            { kind: "fillRect", x: 47, y: 40, w: 6, h: 40 },
        ]);
    });

    it("paints a bear candle (close below open) in the bear colour", () => {
        const ctx = new MockCanvasContext();
        // closeY > openY ⇒ bear.
        const candle: ProjectedCandle = { x: 50, openY: 40, closeY: 80, highY: 20, lowY: 100 };
        drawCandlePaths(ctx, [candle], STYLE);
        const fillSet = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        expect(fillSet).toEqual({ kind: "set", prop: "fillStyle", value: "#ef5350" });
        const rect = ctx.calls.find((c) => c.kind === "fillRect");
        expect(rect).toEqual({ kind: "fillRect", x: 47, y: 40, w: 6, h: 40 });
    });

    it("clamps a doji (open === close) to a 1px body, tinted bull", () => {
        const ctx = new MockCanvasContext();
        const candle: ProjectedCandle = { x: 50, openY: 60, closeY: 60, highY: 20, lowY: 100 };
        drawCandlePaths(ctx, [candle], STYLE);
        const rect = ctx.calls.find((c) => c.kind === "fillRect");
        expect(rect).toEqual({ kind: "fillRect", x: 47, y: 60, w: 6, h: 1 });
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        expect(stroke).toEqual({ kind: "set", prop: "strokeStyle", value: "#26a69a" });
    });

    it("skips a candle with non-finite geometry (a gap)", () => {
        const ctx = new MockCanvasContext();
        const candles: ReadonlyArray<ProjectedCandle> = [
            { x: Number.NaN, openY: 40, closeY: 80, highY: 20, lowY: 100 },
            { x: 50, openY: Number.NaN, closeY: 80, highY: 20, lowY: 100 },
            { x: 50, openY: 40, closeY: Number.NaN, highY: 20, lowY: 100 },
            { x: 50, openY: 40, closeY: 80, highY: Number.NaN, lowY: 100 },
            { x: 50, openY: 40, closeY: 80, highY: 20, lowY: Number.NaN },
        ];
        drawCandlePaths(ctx, candles, STYLE);
        expect(ctx.calls).toEqual([]);
    });

    it("paints nothing for an empty candle array", () => {
        const ctx = new MockCanvasContext();
        drawCandlePaths(ctx, [], STYLE);
        expect(ctx.calls).toEqual([]);
    });
});
