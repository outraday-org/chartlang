// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

import type { Palette } from "../palette";
import type { RenderCtx } from "./clear";
import { priceToY, timeToX, type Viewport } from "./coords";

const BODY_WIDTH_RATIO = 0.6;

/**
 * Draw OHLC candles for every bar in `bars`. Each bar emits a single
 * wick stroke (one `beginPath` + `moveTo` + `lineTo` + `stroke`) and a
 * single `fillRect` for the body. Bullish bars (`close >= open`) use
 * `palette.candleBullBody`; bearish bars use `palette.candleBearBody`.
 *
 * @since 0.1
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const bars: ReadonlyArray<Bar>;
 *     declare const vp: Viewport;
 *     declare const p: Palette;
 *     drawCandles(ctx, bars, vp, p);
 *     void drawCandles;
 */
export function drawCandles(
    ctx: RenderCtx,
    bars: ReadonlyArray<Bar>,
    viewport: Viewport,
    palette: Palette,
): void {
    if (bars.length === 0) return;
    const bodyWidth = (viewport.pxWidth / bars.length) * BODY_WIDTH_RATIO;
    const half = bodyWidth / 2;

    for (const bar of bars) {
        const x = timeToX(bar.time, viewport);
        const openY = priceToY(bar.open, viewport);
        const closeY = priceToY(bar.close, viewport);
        const highY = priceToY(bar.high, viewport);
        const lowY = priceToY(bar.low, viewport);
        const bullish = bar.close >= bar.open;

        ctx.strokeStyle = palette.candleWick;
        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();

        ctx.fillStyle = bullish ? palette.candleBullBody : palette.candleBearBody;
        const top = Math.min(openY, closeY);
        const bottom = Math.max(openY, closeY);
        const height = Math.max(1, bottom - top);
        ctx.fillRect(x - half, top, bodyWidth, height);
    }
}
