// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Price-axis tick math for the Konva adapter. Konva has no chart
// facilities, so — like the candle/series geometry — the adapter computes
// its own "nice" axis labels and paints them as `Text` nodes in the right
// gutter `computePaneViewport` already reserves (`Y_AXIS_GUTTER_PX`). Pure
// number-in/number-out helpers, unit-tested directly.

/**
 * "Nice" evenly-spaced tick values spanning `[min, max]`, snapping the step
 * to a 1 / 2 / 5 × 10ⁿ progression (the canonical axis-label set). Returns
 * roughly `target` ticks. An empty array is returned for a degenerate range
 * (non-finite bounds or `max <= min`), so the caller paints no labels rather
 * than dividing by zero.
 *
 * @example
 *     niceTicks(100, 160, 5); // [100, 110, 120, 130, 140, 150, 160]
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
        // surface as a `120.00000000000001` label; `+ 0` collapses a `-0`
        // (from `Math.ceil` of a tiny negative) to `0`.
        const snapped = Math.round(v / step) * step + 0;
        ticks.push(snapped);
    }
    return ticks;
}

// Snap a raw step up to the nearest 1 / 2 / 5 × 10ⁿ value.
function niceStep(raw: number): number {
    const mag = 10 ** Math.floor(Math.log10(raw));
    const norm = raw / mag;
    const niceNorm = norm > 5 ? 10 : norm > 2 ? 5 : norm > 1 ? 2 : 1;
    return niceNorm * mag;
}

/**
 * Format a tick price for an axis label, choosing decimals from the tick
 * spacing so a `step` of `10` yields `"120"` and a `step` of `0.25` yields
 * `"120.25"`.
 *
 * @example
 *     formatTick(120, 10);   // "120"
 *     formatTick(1.2345, 0.5); // "1.2"
 */
export function formatTick(value: number, step: number): string {
    const decimals = step >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(step)));
    return value.toFixed(decimals);
}

/** The step between two adjacent nice ticks (0 when fewer than two). */
export function tickStep(ticks: readonly number[]): number {
    return ticks.length >= 2 ? (ticks[1] as number) - (ticks[0] as number) : 0;
}
