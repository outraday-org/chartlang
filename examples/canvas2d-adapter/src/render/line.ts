// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Palette } from "../palette.js";
import type { RenderCtx } from "./clear.js";
import { priceToY, timeToX, type PlotPoint, type Viewport } from "./coords.js";

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
 * @since 0.1
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const series: ReadonlyArray<PlotPoint>;
 *     declare const vp: Viewport;
 *     declare const p: Palette;
 *     drawLine(ctx, series, vp, p);
 *     void drawLine;
 */
export function drawLine(
    ctx: RenderCtx,
    series: ReadonlyArray<PlotPoint>,
    viewport: Viewport,
    palette: Palette,
): void {
    if (series.length === 0) return;
    const firstFinite = series.find(isFiniteValue);
    if (firstFinite === undefined) return;
    ctx.strokeStyle = firstFinite.color ?? palette.plotDefault;

    let inPath = false;
    for (const point of series) {
        if (point.value === null || !Number.isFinite(point.value)) {
            if (inPath) {
                ctx.stroke();
                inPath = false;
            }
            continue;
        }
        const x = timeToX(point.time, viewport);
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
