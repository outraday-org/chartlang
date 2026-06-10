// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { LineStyle } from "@invinite-org/chartlang-core";

import type { Palette } from "../palette";
import type { RenderCtx } from "./clear";
import { dashPattern } from "./lineDash";

/**
 * Pre-mapped polyline vertex consumed by {@link drawArea}. `x` / `y`
 * are CSS pixel coordinates the caller derives via `timeToX` /
 * `priceToY`.
 *
 * @since 0.2
 * @stable
 * @example
 *     const p: AreaPoint = { x: 100, y: 50 };
 *     void p;
 */
export type AreaPoint = {
    readonly x: number;
    readonly y: number;
};

/**
 * Inputs for {@link drawArea}. The renderer fills the polygon
 * bounded by the polyline through `points` and the horizontal line
 * at `baselineY`, then strokes the polyline on top.
 *
 * @since 0.2
 * @stable
 * @example
 *     const args: AreaArgs = {
 *         points: [{ x: 0, y: 50 }, { x: 10, y: 40 }],
 *         lineWidth: 1, lineStyle: "solid",
 *         color: "#26a69a", fillAlpha: 0.2, baselineY: 100,
 *     };
 *     void args;
 */
export type AreaArgs = {
    readonly points: ReadonlyArray<AreaPoint>;
    readonly lineWidth: number;
    readonly lineStyle: LineStyle;
    readonly color: string | null;
    readonly fillAlpha: number;
    readonly baselineY: number;
};

/**
 * Render a filled-area plot. Returns early on `< 2` points (no
 * polygon to fill). Sequence:
 *
 * 1. set `fillStyle`, set `globalAlpha = fillAlpha`.
 * 2. trace the filled polygon: `moveTo(first.x, baselineY)` → `lineTo`
 *    through every point → `lineTo(last.x, baselineY)` → `closePath`
 *    → `fill`.
 * 3. reset `globalAlpha = 1`.
 * 4. stroke the top polyline: set `strokeStyle`, `lineWidth`,
 *    `setLineDash(...)` → `moveTo(first)` → `lineTo` per remaining
 *    point → `stroke` → `setLineDash([])` (restore solid).
 *
 * A null `color` falls back to `palette.plotDefault`.
 *
 * @since 0.2
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const palette: Palette;
 *     drawArea(ctx, {
 *         points: [{ x: 0, y: 50 }, { x: 10, y: 40 }, { x: 20, y: 45 }],
 *         lineWidth: 1, lineStyle: "solid",
 *         color: "#26a69a", fillAlpha: 0.2, baselineY: 100,
 *     }, palette);
 *     void drawArea;
 */
export function drawArea(ctx: RenderCtx, args: AreaArgs, palette: Palette): void {
    if (args.points.length < 2) return;
    const color = args.color ?? palette.plotDefault;
    const first = args.points[0];
    const last = args.points[args.points.length - 1];

    // Filled polygon under the line.
    ctx.fillStyle = color;
    ctx.globalAlpha = args.fillAlpha;
    ctx.beginPath();
    ctx.moveTo(first.x, args.baselineY);
    for (const p of args.points) {
        ctx.lineTo(p.x, p.y);
    }
    ctx.lineTo(last.x, args.baselineY);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Stroke the polyline on top.
    ctx.strokeStyle = color;
    ctx.lineWidth = args.lineWidth;
    ctx.setLineDash(dashPattern(args.lineStyle));
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < args.points.length; i++) {
        const p = args.points[i];
        ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
}
