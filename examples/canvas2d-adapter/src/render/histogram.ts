// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Palette } from "../palette";
import type { RenderCtx } from "./clear";

/**
 * Inputs for {@link drawHistogram}. World-space `x` / `y` /
 * `baseline` come pre-mapped by the caller (typically `timeToX` for
 * `x`, `priceToY` for `y` and `baseline`). `width` is the column
 * width in CSS pixels; the renderer centres the rectangle on `x`.
 *
 * @since 0.2
 * @experimental
 * @example
 *     const args: HistogramArgs = {
 *         x: 100, y: 40, baseline: 80, color: "#26a69a", width: 6,
 *     };
 *     void args;
 */
export type HistogramArgs = {
    readonly x: number;
    readonly y: number;
    readonly baseline: number;
    readonly color: string | null;
    readonly width: number;
};

/**
 * Render a histogram column from `baseline` to `y` at `x`. The column
 * is centred on `x` with the supplied `width`; the renderer emits
 * exactly one `fillStyle` set + one `fillRect` per call so tests can
 * pin the canonical sequence. A null `color` falls back to
 * `palette.plotDefault`.
 *
 * @since 0.2
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const palette: Palette;
 *     drawHistogram(ctx, { x: 50, y: 10, baseline: 80, color: "#26a69a", width: 4 }, palette);
 *     void drawHistogram;
 */
export function drawHistogram(ctx: RenderCtx, args: HistogramArgs, palette: Palette): void {
    const top = Math.min(args.y, args.baseline);
    const height = Math.abs(args.y - args.baseline);
    ctx.fillStyle = args.color ?? palette.plotDefault;
    ctx.fillRect(args.x - args.width / 2, top, args.width, height);
}
