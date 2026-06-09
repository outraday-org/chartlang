// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "./clear";
import { priceToY, timeToX, type Viewport } from "./coords";

/**
 * OHLC bar and style inputs for a Phase 5 `bar-override` outline.
 *
 * @since 0.5
 * @experimental
 * @example
 *     declare const bar: Bar;
 *     const args: BarOverrideArgs = { bar, color: "#fff", barCount: 1 };
 *     void args;
 */
export type BarOverrideArgs = {
    readonly bar: Bar;
    readonly color: string;
    readonly barCount: number;
};

const BODY_WIDTH_RATIO = 0.6;

/**
 * Render a Phase-5 `bar-override` OHLC outline.
 *
 * @since 0.5
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const bar: Bar;
 *     declare const viewport: Viewport;
 *     drawBarOverride(ctx, { bar, color: "#fff", barCount: 1 }, viewport);
 */
export function drawBarOverride(ctx: RenderCtx, args: BarOverrideArgs, viewport: Viewport): void {
    const x = timeToX(args.bar.time, viewport);
    const half = ((viewport.pxWidth / Math.max(1, args.barCount)) * BODY_WIDTH_RATIO) / 2;
    const openY = priceToY(args.bar.open, viewport);
    const closeY = priceToY(args.bar.close, viewport);
    const highY = priceToY(args.bar.high, viewport);
    const lowY = priceToY(args.bar.low, viewport);
    ctx.strokeStyle = args.color;
    ctx.beginPath();
    ctx.moveTo(x, highY);
    ctx.lineTo(x, lowY);
    ctx.moveTo(x - half, openY);
    ctx.lineTo(x, openY);
    ctx.moveTo(x, closeY);
    ctx.lineTo(x + half, closeY);
    ctx.stroke();
}
