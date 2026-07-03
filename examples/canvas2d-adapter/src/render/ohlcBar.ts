// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { RenderCtx } from "./clear.js";
import { BODY_WIDTH_RATIO, priceToY, type Viewport } from "./coords.js";

/**
 * Projected inputs for {@link drawOhlcBar}. `x` is the world-space CSS-pixel
 * column (resolved via `projectShiftedX`); `open` / `high` / `low` / `close`
 * are the emission's own per-bar OHLC **world prices** (each `null` on an
 * all-null gap bar), projected with the shared `priceToY`. `color` is the
 * resolved bar color; `upColor` / `downColor`, when set, override it by
 * `close ≥ open`. `barCount` sizes the open / close ticks.
 *
 * @since 1.8
 * @experimental
 * @example
 *     const args: OhlcBarArgs = {
 *         x: 50, open: 100, high: 110, low: 95, close: 108, color: "#f59e0b", barCount: 10,
 *     };
 *     void args;
 */
export type OhlcBarArgs = {
    readonly x: number;
    readonly open: number | null;
    readonly high: number | null;
    readonly low: number | null;
    readonly close: number | null;
    readonly color: string;
    readonly upColor?: string;
    readonly downColor?: string;
    readonly barCount: number;
};

/**
 * Render one derived OHLC bar — Pine `plotbar`. Draws the vertical high-low
 * line, a left tick at `open`, and a right tick at `close`, colored by
 * `close ≥ open` (`upColor ?? color` for an up bar, `downColor ?? color` for a
 * down bar). A bar whose OHLC is all-`null` (a gap) issues no draw calls.
 *
 * @since 1.8
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const viewport: Viewport;
 *     drawOhlcBar(
 *         ctx,
 *         { x: 50, open: 100, high: 110, low: 95, close: 108, color: "#f59e0b", barCount: 10 },
 *         viewport,
 *     );
 *     void drawOhlcBar;
 */
export function drawOhlcBar(ctx: RenderCtx, args: OhlcBarArgs, viewport: Viewport): void {
    const { open, high, low, close } = args;
    if (open === null || high === null || low === null || close === null) return;

    const highY = priceToY(high, viewport);
    const lowY = priceToY(low, viewport);
    const openY = priceToY(open, viewport);
    const closeY = priceToY(close, viewport);
    const up = close >= open;
    const color = up ? (args.upColor ?? args.color) : (args.downColor ?? args.color);
    const half = ((viewport.pxWidth / Math.max(1, args.barCount)) * BODY_WIDTH_RATIO) / 2;

    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(args.x, highY);
    ctx.lineTo(args.x, lowY);
    ctx.moveTo(args.x - half, openY);
    ctx.lineTo(args.x, openY);
    ctx.moveTo(args.x, closeY);
    ctx.lineTo(args.x + half, closeY);
    ctx.stroke();
}
