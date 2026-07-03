// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { RenderCtx } from "./clear.js";
import { BODY_WIDTH_RATIO, MIN_BODY_WIDTH_PX, priceToY, type Viewport } from "./coords.js";

/**
 * Projected inputs for {@link drawCandle}. `x` is the world-space CSS-pixel
 * column (the caller resolves it via `projectShiftedX`); `open` / `high` /
 * `low` / `close` are the emission's own per-bar OHLC **world prices** (each
 * `null` on an all-null gap bar), which the renderer projects with the shared
 * `priceToY`. `bull` / `bear` are the required body colors; `doji` colors an
 * `open === close` bar (falling back to `bull`); `wickColor` colors the
 * high-low wick (falling back to the body color); `borderColor`, when set,
 * strokes the body outline. `barCount` sizes the body width like the primary
 * candles.
 *
 * @since 1.8
 * @experimental
 * @example
 *     const args: CandleArgs = {
 *         x: 50, open: 100, high: 110, low: 95, close: 108,
 *         bull: "#26a69a", bear: "#ef5350", barCount: 10,
 *     };
 *     void args;
 */
export type CandleArgs = {
    readonly x: number;
    readonly open: number | null;
    readonly high: number | null;
    readonly low: number | null;
    readonly close: number | null;
    readonly bull: string;
    readonly bear: string;
    readonly doji?: string;
    readonly wickColor?: string;
    readonly borderColor?: string;
    readonly barCount: number;
};

/**
 * Render one derived candle — Pine `plotcandle`. Draws the high-low wick, then
 * the open-close body (filled by `close > open` ⇒ `bull`, `close < open` ⇒
 * `bear`, `close === open` ⇒ `doji ?? bull`), enforcing a 1px minimum body
 * height (the `candleOverride.ts` precedent); an optional `borderColor` strokes
 * the body outline. A bar whose OHLC is all-`null` (a gap) issues no draw
 * calls.
 *
 * @since 1.8
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const viewport: Viewport;
 *     drawCandle(
 *         ctx,
 *         { x: 50, open: 100, high: 110, low: 95, close: 108, bull: "#26a69a", bear: "#ef5350", barCount: 10 },
 *         viewport,
 *     );
 *     void drawCandle;
 */
export function drawCandle(ctx: RenderCtx, args: CandleArgs, viewport: Viewport): void {
    const { open, high, low, close } = args;
    if (open === null || high === null || low === null || close === null) return;

    const highY = priceToY(high, viewport);
    const lowY = priceToY(low, viewport);
    const openY = priceToY(open, viewport);
    const closeY = priceToY(close, viewport);
    const bodyColor =
        close > open ? args.bull : close < open ? args.bear : (args.doji ?? args.bull);

    ctx.strokeStyle = args.wickColor ?? bodyColor;
    ctx.beginPath();
    ctx.moveTo(args.x, highY);
    ctx.lineTo(args.x, lowY);
    ctx.stroke();

    const bodyWidth = Math.max(
        MIN_BODY_WIDTH_PX,
        (viewport.pxWidth / Math.max(1, args.barCount)) * BODY_WIDTH_RATIO,
    );
    const left = args.x - bodyWidth / 2;
    const top = Math.min(openY, closeY);
    const height = Math.max(1, Math.max(openY, closeY) - top);
    ctx.fillStyle = bodyColor;
    ctx.fillRect(left, top, bodyWidth, height);

    if (args.borderColor !== undefined) {
        ctx.strokeStyle = args.borderColor;
        ctx.beginPath();
        ctx.rect(left, top, bodyWidth, height);
        ctx.stroke();
    }
}
