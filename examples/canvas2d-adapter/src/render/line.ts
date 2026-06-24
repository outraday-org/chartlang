// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Palette } from "../palette.js";
import type { RenderCtx } from "./clear.js";
import { priceToY, projectShiftedX, type PlotPoint, type Viewport } from "./coords.js";

function isFiniteValue(p: PlotPoint): boolean {
    return p.value !== null && Number.isFinite(p.value);
}

/**
 * Draw a polyline through every finite point in `series`. Null /
 * non-finite values break the line into sub-paths — the renderer
 * issues a new `beginPath` whenever a gap follows at least one
 * already-drawn point. The stroke colour is the first finite point's
 * `color` (falling back to `palette.plotDefault` when null).
 *
 * Each point's x is resolved from its `bar` + `xShift` via
 * {@link projectShiftedX} against `bars` / `spacing` (the run's bar
 * window and median spacing), so a presentation offset displaces the
 * line; a point with no `xShift` draws at the pre-shift `timeToX(time)`
 * x. `bars` / `spacing` are world inputs — the renderer stays pure on
 * `ctx`.
 *
 * The stroke is `lineWidth` px wide (the emission's resolved width; the
 * compiler defaults plots to `1`) with round joins/caps so the polyline
 * reads as a smooth curve rather than a mitred sawtooth.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const series: ReadonlyArray<PlotPoint>;
 *     declare const bars: ReadonlyArray<{ time: number }>;
 *     declare const vp: Viewport;
 *     declare const p: Palette;
 *     drawLine(ctx, series, { bars, spacing: 0 }, vp, p, 1);
 *     void drawLine;
 */
export function drawLine(
    ctx: RenderCtx,
    series: ReadonlyArray<PlotPoint>,
    world: { readonly bars: ReadonlyArray<{ readonly time: number }>; readonly spacing: number },
    viewport: Viewport,
    palette: Palette,
    lineWidth: number,
): void {
    if (series.length === 0) return;
    const firstFinite = series.find(isFiniteValue);
    if (firstFinite === undefined) return;
    ctx.strokeStyle = firstFinite.color ?? palette.plotDefault;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    let inPath = false;
    for (const point of series) {
        if (point.value === null || !Number.isFinite(point.value)) {
            if (inPath) {
                ctx.stroke();
                inPath = false;
            }
            continue;
        }
        const x = projectShiftedX(
            { bars: world.bars, bar: point.bar, xShift: point.xShift, spacing: world.spacing },
            viewport,
        );
        const y = priceToY(point.value, viewport);
        if (!inPath) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            inPath = true;
        } else {
            ctx.lineTo(x, y);
        }
    }
    if (inPath) ctx.stroke();
}
