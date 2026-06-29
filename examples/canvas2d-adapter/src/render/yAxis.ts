// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Palette } from "../palette.js";
import type { RenderCtx } from "./clear.js";
import { type Viewport, priceToY } from "./coords.js";

// Density hint — the "nice" tick algorithm picks the closest round step that
// yields roughly this many ticks; the actual count varies with the step.
const TARGET_TICKS = 5;
const AXIS_FONT = "10px sans-serif";
const LABEL_GAP_PX = 6;
// A tick whose y lands within this many px of an edge pins its label baseline
// inward so it is not clipped by the pane boundary.
const EDGE_PX = 8;

// Snap a raw step up to the nearest 1 / 2 / 5 × 10ⁿ value — the classic
// D3 / Graphics-Gems "nice numbers" ladder, so a [-1, 1] pane ticks at
// 0.5 increments (…-1, -0.5, 0, 0.5, 1) instead of an even-division 0.55.
function niceStep(raw: number): number {
    const mag = 10 ** Math.floor(Math.log10(raw));
    const norm = raw / mag;
    const niceNorm = norm > 5 ? 10 : norm > 2 ? 5 : norm > 1 ? 2 : 1;
    return niceNorm * mag;
}

/**
 * "Nice" evenly-spaced tick values spanning `[min, max]`, snapping the step
 * to a round 1 / 2 / 5 × 10ⁿ value and emitting every step multiple inside
 * the range. An empty array is returned for a degenerate / non-finite range.
 *
 * @since 0.2
 * @stable
 * @example
 *     niceTicks(-1.1, 1.1, 5); // [-1, -0.5, 0, 0.5, 1]
 */
export function niceTicks(min: number, max: number, target: number): number[] {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || target <= 0) {
        return [];
    }
    const step = niceStep((max - min) / target);
    const ticks: number[] = [];
    // Start at the first step multiple at or above `min`; the `1e-9 * step`
    // epsilon absorbs float drift so an exact end tick is not dropped.
    const first = Math.ceil(min / step - 1e-9) * step;
    for (let v = first; v <= max + step * 1e-9; v += step) {
        // Re-snap to the step grid so accumulated `+= step` drift does not
        // surface as a `0.30000000000000004` label; `+ 0` collapses a `-0`.
        ticks.push(Math.round(v / step) * step + 0);
    }
    return ticks;
}

/**
 * Format a tick price, choosing decimals from the tick spacing so a `step`
 * of `20` reads `"40"` and a `step` of `0.5` reads `"0.5"`.
 *
 * @since 0.2
 * @stable
 * @example
 *     formatTick(40, 20);  // "40"
 *     formatTick(0.5, 0.5); // "0.5"
 */
export function formatTick(value: number, step: number): string {
    const decimals = step >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(step)));
    return value.toFixed(decimals);
}

/**
 * Draw a per-pane price (y) axis: faint gridlines at "nice" round price
 * levels (1 / 2 / 5 × 10ⁿ steps) plus a right-gutter label at each. The
 * viewport's `pxWidth` is the plot-area width — the gutter where labels sit
 * starts at `pxWidth` and runs to the pane's right edge. Drawn inside the
 * pane-local translate so `y` maps the same way the series and candles do.
 *
 * @since 0.2
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const palette: Palette;
 *     const viewport: Viewport = {
 *         xMin: 0, xMax: 1, yMin: 0, yMax: 100, pxWidth: 588, pxHeight: 80,
 *     };
 *     drawYAxis(ctx, viewport, palette);
 *     void drawYAxis;
 */
export function drawYAxis(ctx: RenderCtx, viewport: Viewport, palette: Palette): void {
    const { pxWidth, pxHeight } = viewport;
    const ticks = niceTicks(viewport.yMin, viewport.yMax, TARGET_TICKS);
    const step = ticks.length >= 2 ? (ticks[1] as number) - (ticks[0] as number) : 1;
    ctx.font = AXIS_FONT;
    ctx.textAlign = "left";
    for (const price of ticks) {
        const y = priceToY(price, viewport);
        ctx.strokeStyle = palette.gridLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(pxWidth, y);
        ctx.stroke();
        ctx.fillStyle = palette.candleWick;
        // Pin near-edge labels inward so the top / bottom ticks are not
        // clipped by the pane boundary.
        ctx.textBaseline = y <= EDGE_PX ? "top" : y >= pxHeight - EDGE_PX ? "bottom" : "middle";
        ctx.fillText(formatTick(price, step), pxWidth + LABEL_GAP_PX, y);
    }
}
