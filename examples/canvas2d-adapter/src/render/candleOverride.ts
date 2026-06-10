// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "./clear";
import { priceToY, timeToX, type Viewport } from "./coords";

/**
 * OHLC bar and palette inputs for a Phase 5 `candle-override` body.
 *
 * @since 0.5
 * @stable
 * @example
 *     declare const bar: Bar;
 *     const args: CandleOverrideArgs = { bar, bull: "#0f0", bear: "#f00", barCount: 1 };
 *     void args;
 */
export type CandleOverrideArgs = {
    readonly bar: Bar;
    readonly bull: string;
    readonly bear: string;
    readonly doji?: string;
    readonly barCount: number;
};

const BODY_WIDTH_RATIO = 0.6;

/**
 * Paint a candle body with Phase-5 `candle-override` colors.
 *
 * @since 0.5
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const bar: Bar;
 *     declare const viewport: Viewport;
 *     drawCandleOverride(ctx, { bar, bull: "#0f0", bear: "#f00", barCount: 1 }, viewport);
 */
export function drawCandleOverride(
    ctx: RenderCtx,
    args: CandleOverrideArgs,
    viewport: Viewport,
): void {
    const x = timeToX(args.bar.time, viewport);
    const openY = priceToY(args.bar.open, viewport);
    const closeY = priceToY(args.bar.close, viewport);
    const top = Math.min(openY, closeY);
    const bottom = Math.max(openY, closeY);
    const bodyWidth = (viewport.pxWidth / Math.max(1, args.barCount)) * BODY_WIDTH_RATIO;
    const color =
        args.bar.close > args.bar.open
            ? args.bull
            : args.bar.close < args.bar.open
              ? args.bear
              : (args.doji ?? args.bull);
    ctx.fillStyle = color;
    ctx.fillRect(x - bodyWidth / 2, top, bodyWidth, Math.max(1, bottom - top));
}
