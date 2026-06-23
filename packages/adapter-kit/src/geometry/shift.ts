// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { timeToX } from "./project.js";
import type { Viewport } from "./types.js";

// The bar-shift projection contract shared by every adapter. A
// `PlotEmission.xShift` (signed integer bars; `+n` right / future, `−n`
// left / past) displaces WHERE a series point draws, not its value. The
// canvas2d reference adapter originated this math; it is promoted here so
// the self-scaled (canvas2d, konva), category/index (echarts), and
// aligned/native-time (uplot, lightweight-charts) adapters all resolve a
// shifted point identically instead of hand-porting four divergent copies.

/**
 * Median adjacent-bar time delta of a run, used to extrapolate the time
 * of a bar that lies past the data edge (a future `+k` shift) or before
 * the first bar (a far-past `−k` shift). Returns `0` for a run of fewer
 * than two bars — a degenerate, zero-spacing run that
 * {@link shiftedBarTime} maps to the anchor bar's own time (no NaN).
 *
 * @since 1.7
 * @stable
 * @example
 *     const s = medianBarSpacing([{ time: 0 }, { time: 10 }, { time: 30 }]);
 *     // s === 15 (median of deltas [10, 20])
 *     void s;
 */
export function medianBarSpacing(bars: ReadonlyArray<{ readonly time: number }>): number {
    if (bars.length < 2) return 0;
    const deltas: number[] = [];
    for (let i = 1; i < bars.length; i++) {
        deltas.push(bars[i].time - bars[i - 1].time);
    }
    deltas.sort((a, b) => a - b);
    const mid = deltas.length >> 1;
    return deltas.length % 2 === 1 ? deltas[mid] : (deltas[mid - 1] + deltas[mid]) / 2;
}

/**
 * Resolve the world time a series point computed at bar index `bar`
 * should render at when displaced by `xShift` bars. The target index
 * `j = bar + xShift`:
 *
 * - in range (`0 ≤ j ≤ last`) ⇒ that bar's exact `time`;
 * - past the last bar (`j > last`) ⇒ extrapolated from the last bar's
 *   time and `spacing` (`+k` future projection);
 * - before the first bar (`j < 0`) ⇒ extrapolated from the first bar's
 *   time and `spacing` (far-past `−k` projection).
 *
 * `xShift` omitted / `0` with an in-range `bar` returns the bar's own
 * time, so the drawn x is byte-identical to the pre-shift
 * `timeToX(point.time)`. An empty bar run returns `0`.
 *
 * @since 1.7
 * @stable
 * @example
 *     const bars = [{ time: 0 }, { time: 10 }, { time: 20 }];
 *     const t = shiftedBarTime({ bars, bar: 1, xShift: -1, spacing: 10 });
 *     // t === 0 (bar 1 shifted one left → bar 0's time)
 *     void t;
 */
export function shiftedBarTime(args: {
    readonly bars: ReadonlyArray<{ readonly time: number }>;
    readonly bar: number;
    readonly xShift: number | undefined;
    readonly spacing: number;
}): number {
    const { bars, bar, spacing } = args;
    const last = bars.length - 1;
    if (last < 0) return 0;
    const j = bar + (args.xShift ?? 0);
    if (j >= 0 && j <= last) return bars[j].time;
    if (j > last) return bars[last].time + (j - last) * spacing;
    return bars[0].time + j * spacing;
}

/**
 * Map a series point's `bar` + `xShift` to an x pixel coordinate:
 * {@link shiftedBarTime} resolves the displaced world time, then
 * {@link timeToX} projects it into the viewport. The single projection
 * funnel every shifted-series render path (line, step-line, histogram,
 * shape / character / arrow glyphs) routes through so the bar-offset
 * math is defined once. Pure on world inputs only — no `ctx`.
 *
 * @since 1.7
 * @stable
 * @example
 *     const bars = [{ time: 0 }, { time: 10 }, { time: 20 }];
 *     const vp = { xMin: 0, xMax: 20, yMin: 0, yMax: 1, pxWidth: 200, pxHeight: 1 };
 *     const x = projectShiftedX({ bars, bar: 0, xShift: 1, spacing: 10 }, vp);
 *     // x === 100 (bar 0 shifted one right → bar 1's x)
 *     void x;
 */
export function projectShiftedX(
    args: {
        readonly bars: ReadonlyArray<{ readonly time: number }>;
        readonly bar: number;
        readonly xShift: number | undefined;
        readonly spacing: number;
    },
    viewport: Viewport,
): number {
    return timeToX(shiftedBarTime(args), viewport);
}

/**
 * The largest world time any of `points` reaches once its POSITIVE
 * `xShift` is applied, never below the `xMax` seed. A self-scaled adapter
 * widens its pane's data `xMax` by this value so a `+k` future-projected
 * point stays inside the viewport instead of being clipped past the data
 * edge. Only `xShift > 0` targets extend the edge — a far-past (`−k`)
 * point is canvas-clipped at negative x and never widens the window, and
 * an omitted / `0` shift contributes nothing. Pass the pane's current
 * `xMax` (e.g. the last bar's time) as the seed; an empty bar run leaves
 * the seed unchanged.
 *
 * @since 1.7
 * @stable
 * @example
 *     const bars = [{ time: 0 }, { time: 10 }, { time: 20 }];
 *     const pts = [{ bar: 2, xShift: 2 }, { bar: 0, xShift: -1 }];
 *     const xMax = maxShiftedTime(pts, bars, 10, 20);
 *     // xMax === 40 (bar 2 shifted +2 → time 40; the −1 point is ignored)
 *     void xMax;
 */
export function maxShiftedTime(
    points: ReadonlyArray<{ readonly bar: number; readonly xShift?: number }>,
    bars: ReadonlyArray<{ readonly time: number }>,
    spacing: number,
    xMax: number,
): number {
    let extended = xMax;
    for (const point of points) {
        const xShift = point.xShift;
        if (xShift === undefined || xShift <= 0) continue;
        const t = shiftedBarTime({ bars, bar: point.bar, xShift, spacing });
        if (t > extended) extended = t;
    }
    return extended;
}

/**
 * The (possibly out-of-range) category index a point computed at `bar`
 * occupies when displaced by `xShift`: `bar + (xShift ?? 0)`. A
 * category/index adapter (ECharts) writes the value at this column,
 * extending its category axis by `max(0, index − lastIndex)` synthetic
 * future slots and clipping a negative `index` (no negative category) —
 * the index analogue of {@link shiftedBarTime}'s time extrapolation.
 *
 * @since 1.7
 * @stable
 * @example
 *     const j = shiftedBarIndex(3, 5);
 *     // j === 8
 *     void j;
 */
export function shiftedBarIndex(bar: number, xShift: number | undefined): number {
    return bar + (xShift ?? 0);
}
