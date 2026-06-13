// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Palette } from "../palette.js";
import type { RenderCtx } from "./clear.js";
import { type Viewport, yToPrice } from "./coords.js";

const TICK_COUNT = 5;
const AXIS_FONT = "10px sans-serif";
const LABEL_GAP_PX = 6;

// Decimal places scale to the visible price span so a wide range
// (e.g. RSI 0-100) reads as integers while a tight one keeps precision.
function formatTick(price: number, span: number): string {
    if (span >= 50) return price.toFixed(0);
    if (span >= 5) return price.toFixed(1);
    return price.toFixed(2);
}

/**
 * Draw a per-pane price (y) axis: {@link TICK_COUNT} evenly spaced
 * faint gridlines spanning the plot area plus a right-gutter price
 * label at each tick. The viewport's `pxWidth` is the plot-area
 * width — the gutter where labels sit starts at `pxWidth` and runs to
 * the pane's right edge (the adapter reserves it by shrinking
 * `pxWidth`). Drawn inside the pane-local translate so `y` maps the
 * same way the series and candles do.
 *
 * @since 0.2
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const palette: Palette;
 *     const viewport: Viewport = {
 *         xMin: 0, xMax: 1, yMin: 0, yMax: 100, pxWidth: 588, pxHeight: 80,
 *     };
 *     drawYAxis(ctx, viewport, palette);
 *     void drawYAxis;
 */
export function drawYAxis(ctx: RenderCtx, viewport: Viewport, palette: Palette): void {
    const { pxWidth, pxHeight } = viewport;
    const span = viewport.yMax - viewport.yMin;
    ctx.font = AXIS_FONT;
    ctx.textAlign = "left";
    for (let i = 0; i < TICK_COUNT; i++) {
        const y = (i / (TICK_COUNT - 1)) * pxHeight;
        ctx.strokeStyle = palette.gridLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(pxWidth, y);
        ctx.stroke();
        ctx.fillStyle = palette.candleWick;
        // Pin the edge labels inside the pane so the top / bottom ticks
        // are not clipped by the pane boundary.
        ctx.textBaseline = i === 0 ? "top" : i === TICK_COUNT - 1 ? "bottom" : "middle";
        ctx.fillText(formatTick(yToPrice(y, viewport), span), pxWidth + LABEL_GAP_PX, y);
    }
}
