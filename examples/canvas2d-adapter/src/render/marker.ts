// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Palette } from "../palette.js";
import type { RenderCtx } from "./clear.js";

/**
 * Discrete marker glyph. Matches the `marker` variant of
 * `PlotStyle.shape` (`@invinite-org/chartlang-adapter-kit`).
 *
 * @since 0.2
 * @stable
 * @example
 *     const s: MarkerShape = "triangle-up";
 *     void s;
 */
export type MarkerShape = "circle" | "triangle-up" | "triangle-down" | "square" | "diamond";

/**
 * Inputs for {@link drawMarker}. World-space `x` / `y` are CSS pixels
 * the caller derives via `timeToX` / `priceToY`. `size` is the
 * glyph's bounding-box edge length in CSS pixels (circle uses `size`
 * as its diameter).
 *
 * @since 0.2
 * @stable
 * @example
 *     const args: MarkerArgs = {
 *         x: 100, y: 50, shape: "triangle-up", size: 8, color: "#26a69a",
 *     };
 *     void args;
 */
export type MarkerArgs = {
    readonly x: number;
    readonly y: number;
    readonly shape: MarkerShape;
    readonly size: number;
    readonly color: string | null;
};

const TWO_PI = Math.PI * 2;

/**
 * Render a discrete marker glyph at (`x`, `y`). The renderer sets
 * `fillStyle` once, then dispatches on `shape`:
 *
 * - `circle` → `arc` → `closePath` → `fill`.
 * - `square` → single `fillRect` (`size x size`, centred on anchor).
 * - `triangle-up` / `triangle-down` / `diamond` → polygon via
 *   `beginPath` + `moveTo` + `lineTo` × 2..3 + `closePath` + `fill`.
 *
 * A null `color` falls back to `palette.plotDefault`.
 *
 * @since 0.2
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const palette: Palette;
 *     drawMarker(ctx, {
 *         x: 100, y: 50, shape: "circle", size: 6, color: "#26a69a",
 *     }, palette);
 *     void drawMarker;
 */
export function drawMarker(ctx: RenderCtx, args: MarkerArgs, palette: Palette): void {
    ctx.fillStyle = args.color ?? palette.plotDefault;
    const half = args.size / 2;
    switch (args.shape) {
        case "circle":
            ctx.beginPath();
            ctx.arc(args.x, args.y, half, 0, TWO_PI);
            ctx.closePath();
            ctx.fill();
            return;
        case "square":
            ctx.fillRect(args.x - half, args.y - half, args.size, args.size);
            return;
        case "triangle-up":
            ctx.beginPath();
            ctx.moveTo(args.x, args.y - half);
            ctx.lineTo(args.x + half, args.y + half);
            ctx.lineTo(args.x - half, args.y + half);
            ctx.closePath();
            ctx.fill();
            return;
        case "triangle-down":
            ctx.beginPath();
            ctx.moveTo(args.x, args.y + half);
            ctx.lineTo(args.x + half, args.y - half);
            ctx.lineTo(args.x - half, args.y - half);
            ctx.closePath();
            ctx.fill();
            return;
        case "diamond":
            ctx.beginPath();
            ctx.moveTo(args.x, args.y - half);
            ctx.lineTo(args.x + half, args.y);
            ctx.lineTo(args.x, args.y + half);
            ctx.lineTo(args.x - half, args.y);
            ctx.closePath();
            ctx.fill();
            return;
    }
}
