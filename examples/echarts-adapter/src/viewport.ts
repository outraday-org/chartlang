// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Viewport } from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";

import type { EChartsSurface } from "./types.js";

// A deterministic fallback drawable size used when ECharts cannot convert
// coordinates yet (headless mock with no `convertToPixel`, or a chart not laid
// out). Drawings still decompose against a stable viewport so `buildOption`
// never throws — the pixels are nominal, not screen-accurate.
const FALLBACK_WIDTH = 800;
const FALLBACK_HEIGHT = 400;

// A sampled pixel corner from ECharts' `convertToPixel` for a known value
// coordinate. `value` is the world `[x, y]` fed in; `pixel` is the `[px, py]`
// ECharts returned.
type Sample = {
    readonly value: readonly [number, number];
    readonly pixel: readonly [number, number];
};

/**
 * Derive a renderer-agnostic {@link Viewport} from two sampled ECharts pixel
 * corners plus the bar-time / price extents, so adapter-kit's linear
 * projection (`timeToX` / `priceToY`) reproduces ECharts' own grid pixels.
 *
 * `lo`/`hi` are `convertToPixel` samples at the value-axis extremes. The grid
 * is linear (value axes are linear; the bar-time axis is linear in ms), so the
 * sampled corner pixels give the grid's pixel rect: `pxWidth`/`pxHeight` from
 * the corner delta, and the `left`/`top` offset is folded into `xMin`/`yMax`
 * by reconstructing the world value at the grid origin. The `Viewport`'s
 * `xMin`/`xMax` are bar TIMES (the x axis is a category of bar times);
 * `decomposeDrawing` does the time→x projection.
 *
 * Pure — no ECharts instance, no DOM — so it is unit-testable against the
 * `convertToPixel` identity.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { computeViewport } from "chartlang-example-echarts-adapter";
 *     const vp = computeViewport(
 *         { value: [0, 100], pixel: [48, 408] },
 *         { value: [9, 110], pixel: [848, 8] },
 *         0,
 *         9,
 *     );
 *     // vp.pxWidth === 800; vp.pxHeight === 400
 *     void vp;
 */
export function computeViewport(lo: Sample, hi: Sample, xMin: number, xMax: number): Viewport {
    const [, loY] = lo.pixel;
    const [, hiY] = hi.pixel;
    const [loPx] = lo.pixel;
    const [hiPx] = hi.pixel;
    const pxWidth = Math.abs(hiPx - loPx);
    const pxHeight = Math.abs(loY - hiY);
    const [, loPrice] = lo.value;
    const [, hiPrice] = hi.value;
    return {
        xMin,
        xMax,
        // ECharts' y grows downward, so the LOWER price sits at the LARGER
        // pixel y. The viewport's `yMin`/`yMax` are world prices; `priceToY`
        // flips them back to pixel space.
        yMin: Math.min(loPrice, hiPrice),
        yMax: Math.max(loPrice, hiPrice),
        pxWidth: pxWidth === 0 ? FALLBACK_WIDTH : pxWidth,
        pxHeight: pxHeight === 0 ? FALLBACK_HEIGHT : pxHeight,
    };
}

function fallbackViewport(bars: ReadonlyArray<Bar>): Viewport {
    let xMin = Number.POSITIVE_INFINITY;
    let xMax = Number.NEGATIVE_INFINITY;
    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;
    for (const bar of bars) {
        if (bar.time < xMin) xMin = bar.time;
        if (bar.time > xMax) xMax = bar.time;
        if (bar.low < yMin) yMin = bar.low;
        if (bar.high > yMax) yMax = bar.high;
    }
    if (!Number.isFinite(xMin)) {
        xMin = 0;
        xMax = 1;
    } else if (xMin === xMax) {
        xMax = xMin + 1;
    }
    if (!Number.isFinite(yMin)) {
        yMin = 0;
        yMax = 1;
    } else if (yMin === yMax) {
        yMin -= 1;
        yMax += 1;
    }
    return { xMin, xMax, yMin, yMax, pxWidth: FALLBACK_WIDTH, pxHeight: FALLBACK_HEIGHT };
}

/**
 * Build the drawing {@link Viewport} for a built chart + its current bar
 * window. When the ECharts surface exposes `convertToPixel`, two grid corners
 * are sampled and handed to {@link computeViewport} so drawings align pixel-
 * perfectly with the candlestick series; otherwise (headless mock, or a chart
 * not yet laid out) a deterministic fallback viewport is returned so the
 * declarative `graphic` array is always well-defined.
 *
 * The bar-time x extent comes from the bar window (the x axis is a category of
 * bar times); the price extent and pixel rect come from the samples. `gridIndex`
 * selects which pane's grid to sample (overlay = 0, subpanes follow
 * `paneOrder`), so a price-anchored visual in a subpane projects against that
 * pane's own scale.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { buildViewport } from "chartlang-example-echarts-adapter";
 *     import type { EChartsSurface } from "chartlang-example-echarts-adapter";
 *     declare const chart: EChartsSurface;
 *     const vp = buildViewport(chart, []);
 *     // vp.pxWidth > 0
 *     void vp;
 */
export function buildViewport(
    chart: EChartsSurface,
    bars: ReadonlyArray<Bar>,
    gridIndex = 0,
): Viewport {
    const fallback = fallbackViewport(bars);
    const convert = chart.convertToPixel;
    // No conversion available (headless default, or a chart not yet laid out):
    // the deterministic fallback keeps the `graphic` array well-defined.
    if (convert === undefined) return fallback;
    const loValue: readonly [number, number] = [fallback.xMin, fallback.yMin];
    const hiValue: readonly [number, number] = [fallback.xMax, fallback.yMax];
    const loPixel = convert.call(chart, { gridIndex }, loValue);
    const hiPixel = convert.call(chart, { gridIndex }, hiValue);
    // ECharts returns `undefined` when the value falls outside any coordinate
    // system (e.g. before the chart has laid out) — fall back rather than feed
    // NaN corners into the projection.
    if (loPixel === undefined || hiPixel === undefined) return fallback;
    return computeViewport(
        { value: loValue, pixel: loPixel },
        { value: hiValue, pixel: hiPixel },
        fallback.xMin,
        fallback.xMax,
    );
}
