// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { RenderCtx } from "./clear.js";
import { timeToX, type Viewport } from "./coords.js";

/**
 * Bar-band inputs for a Phase 5 `bg-color` overlay.
 *
 * @since 0.5
 * @stable
 * @example
 *     const args: BgColorArgs = { time: 0, color: "#00f", transp: 50, barCount: 1 };
 *     void args;
 */
export type BgColorArgs = {
    readonly time: number;
    readonly color: string;
    readonly transp?: number;
    readonly barCount: number;
};

/**
 * Paint a translucent Phase-5 `bg-color` bar band.
 *
 * @since 0.5
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const viewport: Viewport;
 *     drawBgColor(ctx, { time: 0, color: "#00f", transp: 50, barCount: 1 }, viewport);
 */
export function drawBgColor(ctx: RenderCtx, args: BgColorArgs, viewport: Viewport): void {
    const width = viewport.pxWidth / Math.max(1, args.barCount);
    const x = timeToX(args.time, viewport) - width / 2;
    const alpha = 1 - (args.transp ?? 0) / 100;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = args.color;
    ctx.fillRect(x, 0, width, viewport.pxHeight);
    ctx.globalAlpha = 1;
}
