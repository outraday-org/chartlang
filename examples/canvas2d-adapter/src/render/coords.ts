// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { LineStyle } from "@invinite-org/chartlang-core";

/**
 * Visible window into world coordinates. `xMin`/`xMax` are bar times in
 * UTC milliseconds; `yMin`/`yMax` are prices in the quote currency.
 * `pxWidth`/`pxHeight` are the canvas's drawable size in CSS pixels.
 *
 * @since 0.1
 * @stable
 * @example
 *     const vp: Viewport = {
 *         xMin: 0, xMax: 9, yMin: 100, yMax: 110,
 *         pxWidth: 800, pxHeight: 400,
 *     };
 *     void vp;
 */
export type Viewport = {
    readonly xMin: number;
    readonly xMax: number;
    readonly yMin: number;
    readonly yMax: number;
    readonly pxWidth: number;
    readonly pxHeight: number;
};

/**
 * One accumulated point in a plot series, keyed by callsite slot id at
 * the adapter layer (`AdapterState.plotSeries`). `value` is `null` when
 * the script emitted a "skip this bar" gap. `bar` is the source bar
 * index the point was computed at; `xShift` is the presentation-only
 * horizontal display shift in bars (omitted ⇒ no shift). Render paths
 * resolve the drawn x from `bar` + `xShift` via {@link projectShiftedX},
 * so an omitted `xShift` reproduces the pre-shift `timeToX(time)` x.
 *
 * @since 0.1
 * @stable
 * @example
 *     const p: PlotPoint = {
 *         time: 1_700_000_000_000, value: 42.31, color: "#26a69a", bar: 100,
 *     };
 *     void p;
 */
export type PlotPoint = {
    readonly time: number;
    readonly value: number | null;
    readonly color: string | null;
    readonly bar: number;
    readonly xShift?: number;
};

/**
 * One horizontal-line definition keyed by callsite slot id. Stays at
 * the most recent value emitted for the slot — `hline` is a last-write
 * primitive at the adapter layer.
 *
 * @since 0.1
 * @stable
 * @example
 *     const h: HLine = {
 *         price: 70,
 *         color: "#ef4444",
 *         lineWidth: 1,
 *         lineStyle: "dashed",
 *     };
 *     void h;
 */
export type HLine = {
    readonly price: number;
    readonly color: string | null;
    readonly lineWidth: number;
    readonly lineStyle: LineStyle;
};

/**
 * Map a world price to a y pixel coordinate. The y axis is flipped
 * (canvas y grows downward, prices grow upward), so a price at
 * `viewport.yMax` lands at `y = 0` and `viewport.yMin` lands at
 * `y = pxHeight`. The viewport is assumed non-degenerate
 * (`yMax > yMin`); callers feed a non-empty bar window.
 *
 * @since 0.1
 * @stable
 * @example
 *     const y = priceToY(105, { xMin: 0, xMax: 1, yMin: 100, yMax: 110, pxWidth: 1, pxHeight: 100 });
 *     // y === 50
 *     void y;
 */
export function priceToY(price: number, viewport: Viewport): number {
    const span = viewport.yMax - viewport.yMin;
    const normalised = (price - viewport.yMin) / span;
    return viewport.pxHeight - normalised * viewport.pxHeight;
}

/**
 * Inverse of {@link priceToY}: map a y pixel coordinate back to a
 * world price. Useful for interactive overlays (Phase 4+); included
 * now so the renderer ships with the full coordinate pair.
 *
 * @since 0.1
 * @stable
 * @example
 *     const p = yToPrice(50, { xMin: 0, xMax: 1, yMin: 100, yMax: 110, pxWidth: 1, pxHeight: 100 });
 *     // p === 105
 *     void p;
 */
export function yToPrice(y: number, viewport: Viewport): number {
    const normalised = (viewport.pxHeight - y) / viewport.pxHeight;
    return viewport.yMin + normalised * (viewport.yMax - viewport.yMin);
}

/**
 * Map a world time (UTC ms) to an x pixel coordinate. When `xMin ===
 * xMax` (single-bar viewport) the function pins the result to the
 * canvas centre — no NaN propagation.
 *
 * @since 0.1
 * @stable
 * @example
 *     const x = timeToX(5, { xMin: 0, xMax: 10, yMin: 0, yMax: 1, pxWidth: 100, pxHeight: 1 });
 *     // x === 50
 *     void x;
 */
export function timeToX(time: number, viewport: Viewport): number {
    const span = viewport.xMax - viewport.xMin;
    if (span === 0) return viewport.pxWidth / 2;
    const normalised = (time - viewport.xMin) / span;
    return normalised * viewport.pxWidth;
}

/**
 * Median adjacent-bar time delta of a run, used to extrapolate the time
 * of a bar that lies past the data edge (a future `+k` shift) or before
 * the first bar (a far-past `−k` shift). Returns `0` for a run of fewer
 * than two bars — a degenerate, zero-spacing run that
 * {@link shiftedBarTime} maps to the anchor bar's own time (no NaN).
 *
 * @since 1.3
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
 * @since 1.3
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
 * @since 1.3
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
