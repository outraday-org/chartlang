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
 * the script emitted a "skip this bar" gap.
 *
 * @since 0.1
 * @stable
 * @example
 *     const p: PlotPoint = { time: 1_700_000_000_000, value: 42.31, color: "#26a69a" };
 *     void p;
 */
export type PlotPoint = {
    readonly time: number;
    readonly value: number | null;
    readonly color: string | null;
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
