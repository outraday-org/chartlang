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

// A sampled pixel corner from ECharts' `convertToPixel`. `value` is the WORLD
// `[time, price]` the pixel corresponds to; `pixel` is the `[px, py]` ECharts
// returned. NOTE: the x of `value` is a bar TIME, but the corner is SAMPLED at
// the bar's category INDEX (see `buildViewport`) — the category x axis treats a
// raw timestamp as an ordinal index, so sampling at the time would return a
// pixel ~1e12 wide; the time is only the world anchor `decomposeDrawing` projects.
type Sample = {
    readonly value: readonly [number, number];
    readonly pixel: readonly [number, number];
};

/**
 * A `dataZoom` window in percent (0–100) over the bar-time CATEGORY axis. The
 * drawing {@link Viewport} samples the bars this window FRAMES (their on-screen
 * pixels) — not the full data extent — so a chart opened zoomed
 * (`initialVisibleBars`) projects `draw.*` drawings against on-screen bars
 * rather than off-screen ones ECharts cannot convert. The full window
 * `{ start: 0, end: 100 }` reproduces the un-zoomed full-extent build.
 *
 * @since 1.11
 * @stable
 * @example
 *     import type { ZoomWindow } from "chartlang-example-echarts-adapter";
 *     const window: ZoomWindow = { start: 70, end: 100 };
 *     void window;
 */
export type ZoomWindow = { readonly start: number; readonly end: number };

const FULL_WINDOW: ZoomWindow = { start: 0, end: 100 };

/**
 * Reconstruct an ABSOLUTE-pixel {@link Viewport} from two sampled ECharts
 * corners plus the chart's full drawable size, so adapter-kit's linear
 * projection (`timeToX` / `priceToY`) reproduces ECharts' own ABSOLUTE
 * (container-relative) pixels — the coordinate space the `graphic` layer
 * positions in.
 *
 * `lo`/`hi` carry the WORLD value (`[time, price]`) and the ECharts pixel for
 * two corners. The grid is linear (value axes are linear; the bar-time axis is
 * linear in ms over a window), so the two corners fix the world→pixel line. The
 * `Viewport`'s `xMin`/`xMax` (times) and `yMin`/`yMax` (prices) are the world
 * values AT THE CHART'S PIXEL ORIGIN AND FAR EDGE — extrapolated from the
 * corners — and `pxWidth`/`pxHeight` are the full chart size, so the grid's
 * left/top pixel OFFSET is folded in (a drawing at the first bar lands on the
 * grid, not at container pixel 0). `decomposeDrawing` does the time→x / price→y
 * projection.
 *
 * Pure — no ECharts instance, no DOM — so it is unit-testable.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { computeViewport } from "chartlang-example-echarts-adapter";
 *     const vp = computeViewport(
 *         { value: [0, 100], pixel: [48, 408] },
 *         { value: [9, 110], pixel: [848, 8] },
 *         896,
 *         416,
 *     );
 *     // vp.pxWidth === 896; vp.pxHeight === 416
 *     void vp;
 */
export function computeViewport(
    lo: Sample,
    hi: Sample,
    pxWidth: number,
    pxHeight: number,
): Viewport {
    const [timeLo, priceLo] = lo.value;
    const [timeHi, priceHi] = hi.value;
    const [loPx, loPy] = lo.pixel;
    const [hiPx, hiPy] = hi.pixel;
    // time → x: extrapolate the world time at container pixel 0 and `pxWidth`,
    // so `timeToX` (0..pxWidth) yields absolute pixels including the grid offset.
    const timePerPx = (timeHi - timeLo) / (hiPx - loPx);
    const xMin = timeLo - loPx * timePerPx;
    const xMax = xMin + pxWidth * timePerPx;
    // price → y: extrapolate the world price at pixel 0 (top) and `pxHeight`
    // (bottom). ECharts' y grows downward, so the larger pixel y is the LOWER
    // price — `min`/`max` orient `yMin`/`yMax` for `priceToY`.
    const pricePerPx = (priceHi - priceLo) / (hiPy - loPy);
    const priceAtTop = priceLo - loPy * pricePerPx;
    const priceAtBottom = priceLo + (pxHeight - loPy) * pricePerPx;
    return {
        xMin,
        xMax,
        yMin: Math.min(priceAtTop, priceAtBottom),
        yMax: Math.max(priceAtTop, priceAtBottom),
        pxWidth,
        pxHeight,
    };
}

// World bounds (full bar-time x extent + price y extent) used when ECharts
// cannot convert coordinates (headless mock, a chart not laid out, an
// off-screen / degenerate sample). An empty bar run collapses to a unit extent
// so `buildOption` never divides by zero.
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

// The inclusive `[first, last]` visible bar-index range a `dataZoom` percent
// window frames over a category axis of `barCount` bars. ECharts maps a percent
// `p` to category index `p/100 · (barCount − 1)`; the start is FLOORED and the
// end CEILED so the visible slice fully covers the framed window (edge bars
// included), then both are clamped into range and ordered. The default full
// window yields `[0, barCount − 1]` — every bar.
function visibleIndexRange(barCount: number, window: ZoomWindow): readonly [number, number] {
    const lastIndex = barCount - 1;
    const first = Math.max(0, Math.min(lastIndex, Math.floor((window.start / 100) * lastIndex)));
    const last = Math.max(first, Math.min(lastIndex, Math.ceil((window.end / 100) * lastIndex)));
    return [first, last];
}

// Price `[min, max]` over the inclusive bar-index window, padded when degenerate
// so the two sampled y corners are distinct.
function priceExtent(
    bars: ReadonlyArray<Bar>,
    first: number,
    last: number,
): readonly [number, number] {
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (let i = first; i <= last; i += 1) {
        if (bars[i].low < lo) lo = bars[i].low;
        if (bars[i].high > hi) hi = bars[i].high;
    }
    if (lo === hi) {
        lo -= 1;
        hi += 1;
    }
    return [lo, hi];
}

/**
 * Build the drawing {@link Viewport} for a built chart, projected against the
 * VISIBLE `dataZoom` window (`window`, default full). When the ECharts surface
 * exposes `convertToPixel`, two grid corners are sampled and reconstructed into
 * an absolute-pixel viewport so drawings align with the candlestick series;
 * otherwise (headless mock, a chart not yet laid out, an off-screen / degenerate
 * sample) a deterministic fallback viewport keeps `option.graphic` well-defined.
 *
 * Two subtleties make this work on a REAL ECharts chart (the mock models
 * neither, so this is verified live):
 *  1. **Category-INDEX sampling.** The x axis is `type:"category"`, so
 *     `convertToPixel` is sampled at the bar's category INDEX, not its raw
 *     time (a ~1e12 timestamp would be read as an ordinal index → a pixel
 *     trillions wide). The world TIME stays the projection anchor.
 *  2. **In-window corners.** On a zoomed category axis the first data bar is
 *     off-screen and `convertToPixel` returns `undefined`; sampling the FIRST /
 *     LAST VISIBLE index keeps both corners convertible.
 *
 * `gridIndex` selects which pane's grid to sample (overlay = 0, subpanes follow
 * `paneOrder`).
 *
 * @since 1.4
 * @stable
 * @example
 *     import { buildViewport } from "chartlang-example-echarts-adapter";
 *     import type { EChartsSurface } from "chartlang-example-echarts-adapter";
 *     declare const chart: EChartsSurface;
 *     const vp = buildViewport(chart, [], 0, { start: 70, end: 100 });
 *     // vp.pxWidth > 0
 *     void vp;
 */
export function buildViewport(
    chart: EChartsSurface,
    bars: ReadonlyArray<Bar>,
    gridIndex = 0,
    window: ZoomWindow = FULL_WINDOW,
): Viewport {
    const fallback = fallbackViewport(bars);
    const convert = chart.convertToPixel;
    // No conversion available (headless default, or a chart not yet laid out):
    // the deterministic fallback keeps the `graphic` array well-defined.
    if (convert === undefined) return fallback;
    if (bars.length === 0) return fallback;
    const [first, last] = visibleIndexRange(bars.length, window);
    // A single visible column gives no horizontal basis to project against.
    if (first === last) return fallback;
    const [priceLo, priceHi] = priceExtent(bars, first, last);
    // Sample at the first / last VISIBLE category INDEX (x) and the window's
    // price extent (y). Before its first layout a live ECharts chart has no
    // coordinate system, so `convertToPixel` THROWS — treat that the same as an
    // out-of-system result and fall back.
    let loPixel: readonly [number, number] | undefined;
    let hiPixel: readonly [number, number] | undefined;
    try {
        loPixel = convert.call(chart, { gridIndex }, [first, priceLo]);
        hiPixel = convert.call(chart, { gridIndex }, [last, priceHi]);
    } catch {
        return fallback;
    }
    // ECharts returns `undefined` for a value outside any coordinate system.
    if (loPixel === undefined || hiPixel === undefined) return fallback;
    // Degenerate basis (zero pixel span on either axis) — cannot invert.
    if (loPixel[0] === hiPixel[0] || loPixel[1] === hiPixel[1]) return fallback;
    return computeViewport(
        { value: [bars[first].time, priceLo], pixel: loPixel },
        { value: [bars[last].time, priceHi], pixel: hiPixel },
        chart.getWidth(),
        chart.getHeight(),
    );
}
