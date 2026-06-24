// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Palette } from "../palette.js";
import type { RenderCtx } from "./clear.js";
import { resolvePaintColor } from "./colorValue.js";
import { type PlotPoint, type Viewport, priceToY, projectShiftedX } from "./coords.js";
import { monotoneCubicSegments } from "./monotoneSpline.js";

function isFiniteValue(p: PlotPoint): boolean {
    return p.value !== null && Number.isFinite(p.value);
}

// Stroke one contiguous run of pixel points. `step` takes precedence: each
// segment is a horizontal `lineTo(xNext, yPrev)` knee then a vertical
// `lineTo(xNext, yNext)` (Pine/LWC `WithSteps` parity). Otherwise `smooth`
// with ≥3 points emits a monotone-cubic curve (smooth MA line, no overshoot);
// the fallback is a straight polyline (2-point runs and pre-smoothing goldens).
function strokeRun(
    ctx: RenderCtx,
    run: ReadonlyArray<{ x: number; y: number }>,
    smooth: boolean,
    step: boolean,
): void {
    ctx.beginPath();
    ctx.moveTo(run[0].x, run[0].y);
    if (step) {
        for (let i = 1; i < run.length; i += 1) {
            ctx.lineTo(run[i].x, run[i - 1].y);
            ctx.lineTo(run[i].x, run[i].y);
        }
    } else if (smooth && run.length >= 3) {
        for (const s of monotoneCubicSegments(run))
            ctx.bezierCurveTo(s.c1x, s.c1y, s.c2x, s.c2y, s.x, s.y);
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
 * compiler defaults plots to `1`) with round joins/caps. When `step` is set
 * (a `step-line` plot) each segment is a horizontal-then-vertical knee
 * (`lineTo(xNext, yPrev)` then `lineTo(xNext, yNext)`), the
 * hold-then-jump staircase. Otherwise, when `smooth` is set (the default for
 * plain `line` plots) each contiguous run of ≥3 finite points is stroked as a
 * monotone-cubic curve so the line reads as a smooth curve at any bar density;
 * with neither flag (area edges, 2-point runs) it stays a straight polyline.
 * Null / non-finite values still break the line into independent runs.
 *
 * Each point's paint color is resolved under the `PlotEmission.colorValue`
 * 3-state precedence ({@link resolvePaintColor}): omitted ⇒ the point's
 * static `color` (or `palette.plotDefault`); present ⇒ that bar's segment
 * paints in `colorValue`; `null` ⇒ a paint-nothing gap that breaks the run
 * like a `value:null` gap. Because a polyline crosses bars, a color change
 * starts a new stroked sub-path: the line paints as consecutive same-color
 * runs (a `colorValue` equal to the static color coalesces — no spurious
 * split). When no point carries a `colorValue` the whole series is one
 * color, so the call log is byte-identical to the pre-feature render.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const series: ReadonlyArray<PlotPoint>;
 *     declare const bars: ReadonlyArray<{ time: number }>;
 *     declare const vp: Viewport;
 *     declare const p: Palette;
 *     drawLine(ctx, series, { bars, spacing: 0 }, vp, p, 1, true, false);
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
    step: boolean,
): void {
    if (series.length === 0) return;
    // The first paintable point — finite value AND a non-`null` resolved
    // color — seeds `strokeStyle` and the line-style sets up front, exactly
    // as the pre-`colorValue` renderer did. Captured as a `string` (not the
    // helper's `string | null`) so no defensive fallback branch is needed. A
    // series with no paintable point (all gaps / all `colorValue:null`) draws
    // nothing.
    let seedStroke: string | undefined;
    for (const p of series) {
        if (!isFiniteValue(p)) continue;
        const resolved = resolvePaintColor(p.colorValue, p.color, palette.plotDefault);
        if (resolved !== null) {
            seedStroke = resolved;
            break;
        }
    }
    if (seedStroke === undefined) return;
    let lastStroke = seedStroke;
    ctx.strokeStyle = lastStroke;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    let run: { x: number; y: number }[] = [];
    // The color the current run is stroked in (the first point's resolved
    // color); `null` ⇒ no open run.
    let runColor: string | null = null;
    const flush = (): void => {
        if (run.length > 0 && runColor !== null) {
            // Re-set `strokeStyle` only when this run's color differs from
            // the last value written — a single-color series sets it once
            // up front and never here, keeping the call log byte-identical.
            if (runColor !== lastStroke) {
                ctx.strokeStyle = runColor;
                lastStroke = runColor;
            }
            strokeRun(ctx, run, smooth, step);
        }
        run = [];
        runColor = null;
    };
    for (const point of series) {
        if (point.value === null || !Number.isFinite(point.value)) {
            flush();
            continue;
        }
        // `colorValue:null` is the explicit paint-nothing gap (break the run).
        if (point.colorValue === null) {
            flush();
            continue;
        }
        // A run splits only on an EXPLICIT per-bar `colorValue` that differs
        // from the run's color — the static top-level `color` is a per-series
        // property that never splits, so a no-`colorValue` series stays one
        // run (byte-identical to the pre-feature render). An empty run adopts
        // the point's resolved color as its run color.
        const color = resolvePaintColor(point.colorValue, point.color, palette.plotDefault);
        if (run.length === 0) {
            runColor = color;
        } else if (point.colorValue !== undefined && color !== runColor) {
            flush();
            runColor = color;
        }
        const x = projectShiftedX(
            { bars: world.bars, bar: point.bar, xShift: point.xShift, spacing: world.spacing },
            viewport,
        );
        run.push({ x, y: priceToY(point.value, viewport) });
    }
    flush();
}
