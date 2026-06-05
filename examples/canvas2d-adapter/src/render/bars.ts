// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Palette } from "../palette";
import type { RenderCtx } from "./clear";

/**
 * Inputs for {@link drawBars}. Same shape as
 * {@link import("./histogram").HistogramArgs} minus the `width` field
 * — bars are pinned to 1 px wide regardless of zoom so adjacent
 * columns never overlap.
 *
 * @since 0.2
 * @experimental
 * @example
 *     const args: BarsArgs = { x: 100, y: 40, baseline: 80, color: "#26a69a" };
 *     void args;
 */
export type BarsArgs = {
    readonly x: number;
    readonly y: number;
    readonly baseline: number;
    readonly color: string | null;
};

const BARS_WIDTH_PX = 1;

/**
 * Render a 1 px wide vertical bar from `baseline` to `y` at `x`. The
 * column is centred on `Math.round(x)` so adjacent integer-x columns
 * sit on adjacent pixels. Emits exactly one `fillStyle` set + one
 * `fillRect` per call.
 *
 * @since 0.2
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const palette: Palette;
 *     drawBars(ctx, { x: 50, y: 10, baseline: 80, color: "#ef5350" }, palette);
 *     void drawBars;
 */
export function drawBars(ctx: RenderCtx, args: BarsArgs, palette: Palette): void {
    const top = Math.min(args.y, args.baseline);
    const height = Math.abs(args.y - args.baseline);
    ctx.fillStyle = args.color ?? palette.plotDefault;
    ctx.fillRect(Math.round(args.x) - BARS_WIDTH_PX / 2, top, BARS_WIDTH_PX, height);
}
