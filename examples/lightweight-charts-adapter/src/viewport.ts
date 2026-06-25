// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// ---------------------------------------------------------------------------
// Viewport from lightweight-charts converters (Task 6, §2 decision A).
//
// adapter-kit's `Viewport` is defined in WORLD units (time, price) and its
// `timeToX` / `priceToY` are LINEAR over that window. lightweight-charts hands
// us its own non-linear-capable projectors (`timeScale.timeToCoordinate`,
// `series.priceToCoordinate`) in MEDIA pixels, while the series-primitive
// renderer paints in BITMAP pixels (`useBitmapCoordinateSpace`).
//
// We synthesise a LINEAR `Viewport` (option A) that reproduces LC's MEDIA
// coordinates at the visible extremes, scaled into BITMAP space by the scope's
// pixel ratios. `decomposeDrawing`'s linear `timeToX` / `priceToY` then land
// exactly on LC's coordinates at those anchors. This is EXACT when LC's price
// scale is linear over the visible window (the v5 default) and an
// APPROXIMATION on a log price scale — drawings drift toward the edges of a
// log axis. A log-scale-exact path (threading LC's converters through a
// `project?` override on `decomposeDrawing`) is the documented follow-up.
//
// World anchors:
//   - time:  the visible range `from`/`to` (UTC ms), sampled to media x.
//   - price: the pane top/bottom (media y `0` / `mediaHeight`), inverted to
//            world price via `coordinateToPrice`.
// Any null converter result (off-screen / no data yet) → a degenerate
// 0..pxWidth / 0..pxHeight identity viewport so painting is a coordinate
// no-op rather than a throw.
// ---------------------------------------------------------------------------

import type { Viewport } from "@invinite-org/chartlang-adapter-kit";

/**
 * The lightweight-charts time-scale methods {@link buildViewport} reads — a
 * narrow structural subset of v5's `ITimeScaleApi` so tests need no real
 * chart. `timeToCoordinate` returns a MEDIA-space x (or `null` when the time
 * is outside the loaded data); `getVisibleRange` gives the visible window in
 * the horizontal-scale item type (UTC-second / ms timestamps here).
 *
 * @since 1.4
 * @stable
 * @example
 *     const ts: LwcTimeScaleProjector = {
 *         getVisibleRange: () => ({ from: 0, to: 10 }),
 *         timeToCoordinate: (t) => Number(t),
 *     };
 *     void ts;
 */
export type LwcTimeScaleProjector = {
    getVisibleRange(): { from: unknown; to: unknown } | null;
    timeToCoordinate(time: number): number | null;
};

/**
 * The lightweight-charts series methods {@link buildViewport} reads — a narrow
 * structural subset of v5's `ISeriesApi`. `coordinateToPrice` inverts a
 * MEDIA-space y back to a world price (linear on the default price scale);
 * `priceToCoordinate` is its forward partner. Either returns `null` before the
 * series has data.
 *
 * @since 1.4
 * @stable
 * @example
 *     const s: LwcSeriesProjector = {
 *         priceToCoordinate: (p) => p,
 *         coordinateToPrice: (y) => y,
 *     };
 *     void s;
 */
export type LwcSeriesProjector = {
    priceToCoordinate(price: number): number | null;
    coordinateToPrice(coordinate: number): number | null;
};

/**
 * The `useBitmapCoordinateSpace` scope fields {@link buildViewport} reads — a
 * narrow structural subset of fancy-canvas's `BitmapCoordinatesRenderingScope`.
 * `bitmapSize` is the drawable size in DEVICE pixels (what the primitive paints
 * in); `mediaSize` is the CSS-pixel size LC's converters speak; the pixel
 * ratios bridge media → bitmap.
 *
 * @since 1.4
 * @stable
 * @example
 *     const scope: BitmapScope = {
 *         bitmapSize: { width: 800, height: 400 },
 *         mediaSize: { width: 400, height: 200 },
 *         horizontalPixelRatio: 2,
 *         verticalPixelRatio: 2,
 *     };
 *     void scope;
 */
export type BitmapScope = {
    readonly bitmapSize: { readonly width: number; readonly height: number };
    readonly mediaSize: { readonly width: number; readonly height: number };
    readonly horizontalPixelRatio: number;
    readonly verticalPixelRatio: number;
};

// Both visible-range endpoints arrive as `unknown` (LC brands its horizontal
// scale item); we only ever pass numeric timestamps in, so a finite-number
// narrow is all the geometry needs.
function asFiniteTime(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Solve the linear world→pixel line for one axis. Given two world anchors and
// their target pixel coordinates, return the `[min, max]` world values that map
// to pixel `0` and `pxSize`, matching adapter-kit's `(v - min)/(max - min) *
// pxSize` form. Returns `null` when the two pixel anchors coincide (zero
// slope — no resolvable scale), so the caller can fall back to identity.
function solveLinearAxis(
    worldA: number,
    pixelA: number,
    worldB: number,
    pixelB: number,
    pxSize: number,
): readonly [number, number] | null {
    const pixelSpan = pixelB - pixelA;
    if (pixelSpan === 0) return null;
    // px per world unit; world per px is its inverse.
    const worldPerPixel = (worldB - worldA) / pixelSpan;
    const min = worldA - pixelA * worldPerPixel;
    const max = worldA + (pxSize - pixelA) * worldPerPixel;
    return [min, max];
}

// A degenerate viewport whose linear projection is the identity in bitmap
// space — any world coordinate equal to its pixel index maps to itself. Used
// when LC cannot resolve a finite visible window yet (no data / off-screen),
// so `decomposeDrawing` produces finite-but-off-screen pixels rather than NaN.
function identityViewport(pxWidth: number, pxHeight: number): Viewport {
    return {
        xMin: 0,
        xMax: pxWidth,
        yMin: 0,
        yMax: pxHeight,
        pxWidth,
        pxHeight,
    };
}

/**
 * Build an adapter-kit {@link Viewport} from lightweight-charts' converters so
 * `decomposeDrawing`'s linear `timeToX` / `priceToY` reproduce LC's on-screen
 * coordinates in BITMAP pixel space. Samples the visible time range
 * (`timeScale`) and the pane price extents (`series`), scales the resulting
 * MEDIA coordinates into bitmap space via the scope's pixel ratios, then solves
 * the linear world window that lands those anchors on the right pixels.
 *
 * Exact on a linear price scale (the v5 default); approximate on a log scale.
 * Any non-resolvable axis (no visible range, `null` converter, coincident
 * anchors) falls back to an identity viewport for that axis so painting never
 * throws.
 *
 * @since 1.4
 * @stable
 * @example
 *     declare const timeScale: LwcTimeScaleProjector;
 *     declare const series: LwcSeriesProjector;
 *     declare const scope: BitmapScope;
 *     const view = buildViewport(series, timeScale, scope);
 *     void view;
 */
export function buildViewport(
    series: LwcSeriesProjector,
    timeScale: LwcTimeScaleProjector,
    scope: BitmapScope,
): Viewport {
    const pxWidth = scope.bitmapSize.width;
    const pxHeight = scope.bitmapSize.height;
    const fallback = identityViewport(pxWidth, pxHeight);

    let xMin = fallback.xMin;
    let xMax = fallback.xMax;
    const range = timeScale.getVisibleRange();
    const from = range === null ? null : asFiniteTime(range.from);
    const to = range === null ? null : asFiniteTime(range.to);
    if (from !== null && to !== null) {
        const mediaFrom = timeScale.timeToCoordinate(from);
        const mediaTo = timeScale.timeToCoordinate(to);
        if (mediaFrom !== null && mediaTo !== null) {
            const solved = solveLinearAxis(
                from,
                mediaFrom * scope.horizontalPixelRatio,
                to,
                mediaTo * scope.horizontalPixelRatio,
                pxWidth,
            );
            if (solved !== null) {
                [xMin, xMax] = solved;
            }
        }
    }

    let yMin = fallback.yMin;
    let yMax = fallback.yMax;
    // Pane top (media y 0) and bottom (media y mediaHeight) → world prices.
    // priceToY is y-flipped: the TOP price is `yMax` (maps to pixel 0) and the
    // BOTTOM price is `yMin` (maps to pixel pxHeight). On a linear price scale
    // those two anchors fully determine the window — no slope solve needed
    // (the pane spans the full pxHeight). A degenerate range (equal top/bottom,
    // e.g. a flat single-price pane) keeps the identity fallback so
    // `priceToY`'s `yMax - yMin` divisor stays non-zero.
    const priceTop = series.coordinateToPrice(0);
    const priceBottom = series.coordinateToPrice(scope.mediaSize.height);
    if (priceTop !== null && priceBottom !== null && priceTop !== priceBottom) {
        yMax = priceTop;
        yMin = priceBottom;
    }

    // The bitmap viewport is in DEVICE px (the primitive paints into the
    // `useBitmapCoordinateSpace` scope). Carry the horizontal pixel ratio so
    // the screen-space `table` HUD scales its CSS-px cell / font sizes up to
    // device px and renders at its intended physical size on a Retina canvas.
    // A degenerate (zero / non-finite) ratio is guarded downstream by
    // `decomposeTable`'s `tableScale` (⇒ `1`), so no guard is needed here.
    return { xMin, xMax, yMin, yMax, pxWidth, pxHeight, pxRatio: scope.horizontalPixelRatio };
}
