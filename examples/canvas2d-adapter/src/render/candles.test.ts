// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { SAMPLE_BARS } from "../__fixtures__/sampleBars.js";
import { DEFAULT_PALETTE } from "../palette.js";
import { MockCanvas2DContext } from "../testing.js";
import { drawCandles } from "./candles.js";
import type { Viewport } from "./coords.js";

const viewport: Viewport = {
    xMin: SAMPLE_BARS[0].time,
    xMax: SAMPLE_BARS[SAMPLE_BARS.length - 1].time,
    yMin: 90,
    yMax: 120,
    pxWidth: 800,
    pxHeight: 400,
};

describe("drawCandles", () => {
    it("returns early on an empty bar window without touching ctx", () => {
        const ctx = new MockCanvas2DContext();
        drawCandles(ctx, [], viewport, DEFAULT_PALETTE);
        expect(ctx.calls).toEqual([]);
    });

    it("emits one wick stroke and one body fill per bar", () => {
        const ctx = new MockCanvas2DContext();
        drawCandles(ctx, SAMPLE_BARS, viewport, DEFAULT_PALETTE);
        const wickStrokes = ctx.calls.filter((c) => c.kind === "stroke").length;
        const bodyFills = ctx.calls.filter((c) => c.kind === "fillRect").length;
        expect(wickStrokes).toBe(SAMPLE_BARS.length);
        expect(bodyFills).toBe(SAMPLE_BARS.length);
    });

    it("uses bull / bear body colours depending on bar direction", () => {
        const ctx = new MockCanvas2DContext();
        drawCandles(ctx, SAMPLE_BARS, viewport, DEFAULT_PALETTE);
        const bullColors = ctx.calls.filter(
            (c) =>
                c.kind === "set" &&
                c.prop === "fillStyle" &&
                c.value === DEFAULT_PALETTE.candleBullBody,
        );
        const bearColors = ctx.calls.filter(
            (c) =>
                c.kind === "set" &&
                c.prop === "fillStyle" &&
                c.value === DEFAULT_PALETTE.candleBearBody,
        );
        const bullishBars = SAMPLE_BARS.filter((b) => b.close >= b.open).length;
        const bearishBars = SAMPLE_BARS.length - bullishBars;
        expect(bullColors.length).toBe(bullishBars);
        expect(bearColors.length).toBe(bearishBars);
    });
});
