// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Palette } from "../palette.js";
import type { RenderCtx } from "./clear.js";
import { priceToY, projectShiftedX, type PlotPoint, type Viewport } from "./coords.js";
import { monotoneCubicSegments } from "./monotoneSpline.js";

function isFiniteValue(p: PlotPoint): boolean {
    return p.value !== null && Number.isFinite(p.value);
}

// Stroke one contiguous run of pixel points. With `smooth` and ≥3 points the
// run is a monotone-cubic curve (smooth MA line, no overshoot); otherwise a
// straight polyline (step-lines, 2-point runs, and pre-smoothing goldens).
function strokeRun(ctx: RenderCtx, run: ReadonlyArray<{ x: number; y: number }>, smooth: boolean): void {
    ctx.beginPath();
    ctx.moveTo(run[0].x, run[0].y);
    if (smooth && run.length >= 3) {
        for (const s of monotoneCubicSegments(run)) ctx.bezierCurveTo(s.c1x, s.c1y, s.c2x, s.c2y, s.x, s.y);
    } else {
        for (let i = 1; i < run.length; i += 1) ctx.lineTo(run[i].x, run[i].y);
    }
    ctx.stroke();
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
 * compiler defaults plots to `1`) with round joins/caps. When `smooth` is
 * set (the default for plain `line` plots) each contiguous run of ≥3 finite
 * points is stroked as a monotone-cubic curve so the line reads as a smooth
 * curve at any bar density; `smooth = false` (step-lines, area edges) keeps
 * straight segments. Null / non-finite values still break the line into
 * independent runs.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const series: ReadonlyArray<PlotPoint>;
 *     declare const bars: ReadonlyArray<{ time: number }>;
 *     declare const vp: Viewport;
 *     declare const p: Palette;
 *     drawLine(ctx, series, { bars, spacing: 0 }, vp, p, 1, true);
 *     void drawLine;
 */
export function drawLine(
    ctx: RenderCtx,
    series: ReadonlyArray<PlotPoint>,
    world: { readonly bars: ReadonlyArray<{ readonly time: number }>; readonly spacing: number },
    viewport: Viewport,
    palette: Palette,
    lineWidth: number,
    smooth: boolean,
): void {
    if (series.length === 0) return;
    const firstFinite = series.find(isFiniteValue);
    if (firstFinite === undefined) return;
    ctx.strokeStyle = firstFinite.color ?? palette.plotDefault;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    let run: { x: number; y: number }[] = [];
    const flush = (): void => {
        if (run.length > 0) {
            strokeRun(ctx, run, smooth);
            run = [];
        }
    };
    for (const point of series) {
        if (point.value === null || !Number.isFinite(point.value)) {
            flush();
            continue;
        }
        const x = projectShiftedX(
            { bars: world.bars, bar: point.bar, xShift: point.xShift, spacing: world.spacing },
            viewport,
        );
        run.push({ x, y: priceToY(point.value, viewport) });
    }
    flush();
}
