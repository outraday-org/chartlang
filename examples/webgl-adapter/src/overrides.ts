// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Candle / background OVERRIDE + horizontal-volume-bars resolution for the 2D
// text overlay. PURE: it reads the `bg-color` / `bar-color` / `candle-override`
// / `bar-override` / `horizontal-histogram` emissions buffered in
// `state.plotOverlays` (Task 4 routed them there) and resolves them into
// CSS-pixel paint items projected through the overlay-pane `Viewport` (the SAME
// `paneViewportFromInfo` the glyph / drawing anchors use — ONE projection
// source per frame). The colour precedence + candle-direction semantics mirror
// the canvas2d reference's `drawBgColor` / `drawBarColor` / `drawCandleOverride`
// / `drawHorizontalHistogram` byte-for-concept; they are re-implemented here
// (the no-cross-example-`src`-import invariant forbids importing canvas2d's).
//
// GL paints the candle GEOMETRY; the overrides tint over it on the overlay —
// the deliberate GL-geometry / overlay-paint split (README §4, the Task-13
// drawings-on-overlay precedent). The pure resolution is node-unit-tested; the
// 2D paint (overlay.ts) is browser-only.

import { type Viewport, priceToY, timeToX } from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";

import type { AxisRenderInfo } from "./axes.js";
import { paneViewportFromInfo } from "./glyphs.js";
import type { AdapterState } from "./state.js";

// Candle / bar override body width as a fraction of the per-bar slot, matching
// the canvas2d reference's `BODY_WIDTH_RATIO`.
const BODY_WIDTH_RATIO = 0.6;
// Right-edge horizontal-volume-bars layout (canvas2d parity:
// `HORIZONTAL_HISTOGRAM_MAX_WIDTH_PX` / `HORIZONTAL_HISTOGRAM_ROW_HEIGHT_PX`).
const HORIZONTAL_HISTOGRAM_MAX_WIDTH_PX = 96;
const HORIZONTAL_HISTOGRAM_ROW_HEIGHT_PX = 6;

/**
 * A translucent full-height background band for one bar (`bg-color`). `x` /
 * `width` / `height` are CSS-px (the band fills the overlay pane's height —
 * `viewport.pxHeight`); `alpha` is the resolved opacity (`1 - transp/100`).
 * Built by {@link resolveOverridePaint}.
 *
 * @since 0.1
 * @stable
 * @example
 *     const b: BackgroundBand = { x: 10, width: 6, height: 400, color: "#1d4ed8", alpha: 0.2 };
 *     void b;
 */
export type BackgroundBand = {
    readonly x: number;
    readonly width: number;
    readonly height: number;
    readonly color: string;
    readonly alpha: number;
};

/**
 * A per-bar override paint item — either a filled `candle` body
 * (`candle-override`) or a stroked OHLC `bar` outline (`bar-override` /
 * `bar-color`), already resolved to its CSS-px geometry + colour.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const item: BarOverlayItem;
 *     void item;
 */
export type BarOverlayItem =
    | {
          readonly kind: "candle";
          readonly x: number;
          readonly bodyWidth: number;
          readonly top: number;
          readonly height: number;
          readonly color: string;
      }
    | {
          readonly kind: "bar";
          readonly x: number;
          readonly half: number;
          readonly highY: number;
          readonly lowY: number;
          readonly openY: number;
          readonly closeY: number;
          readonly color: string;
      };

/**
 * One resolved right-edge horizontal-volume row: a filled rectangle whose
 * `width` is proportional to the bucket volume and whose `y` is the bucket
 * price projected into the pane. Built by {@link resolveHorizontalHistogram}.
 *
 * @since 0.1
 * @stable
 * @example
 *     const r: HistogramRow = { x: 700, y: 50, width: 60, height: 6, color: "#90caf9" };
 *     void r;
 */
export type HistogramRow = {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly color: string;
};

/**
 * The resolved overlay-substrate paint items for one frame: translucent
 * `bg-color` background bands + per-bar candle / bar overrides. Painted BEFORE
 * the z-sorted glyph / drawing pass (and after the GL candles), exactly as the
 * canvas2d reference paints `renderBackgroundOverlays` / `renderBarOverlays`.
 *
 * @since 0.1
 * @stable
 * @example
 *     const p: OverridePaint = { backgrounds: [], bars: [] };
 *     void p;
 */
export type OverridePaint = {
    readonly backgrounds: ReadonlyArray<BackgroundBand>;
    readonly bars: ReadonlyArray<BarOverlayItem>;
};

// The per-bar CSS-px slot width (one band per bar across the visible window).
function barSlotWidth(viewport: Viewport, barCount: number): number {
    return viewport.pxWidth / Math.max(1, barCount);
}

/**
 * Resolve every buffered `bg-color` / `bar-color` / `candle-override` /
 * `bar-override` emission in `state.plotOverlays` into CSS-pixel
 * {@link OverridePaint} items for the overlay pane, projected through the
 * overlay {@link Viewport}. Mirrors the canvas2d reference's precedence + candle
 * direction semantics:
 *
 * - `bg-color`: the per-bar `colorValue` (when present) wins over the static
 *   `style.color`; a `null` gap paints nothing; `alpha = 1 - transp/100`;
 * - `bar-color`: same `colorValue`-over-`style.color`-`null`-gap precedence;
 * - `candle-override`: bull / bear / doji by bar direction
 *   (`close > open` / `close < open` / else), NOT a whole-series tint;
 * - `bar-override`: a stroked OHLC outline in `style.color`.
 *
 * Override anchors are the bar's OWN time (these are candle state, not shifted
 * series — `xShift` never applies). A `bar-color` / `bar-override` /
 * `candle-override` whose bar is not in `state.bars` is skipped (no bar to tint).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { createAdapterState } from "chartlang-example-webgl-adapter";
 *     import { resolveOverridePaint } from "chartlang-example-webgl-adapter";
 *     const state = createAdapterState();
 *     const paint = resolveOverridePaint(state, {
 *         paneKey: "overlay",
 *         cssRect: { x: 0, y: 0, width: 800, height: 400 },
 *         window: { xMin: 0, xMax: 100, yMin: 1, yMax: 2 },
 *         ticks: { priceTicks: [], timeTicks: [] },
 *     });
 *     // paint.backgrounds.length === 0
 *     void paint;
 */
export function resolveOverridePaint(state: AdapterState, info: AxisRenderInfo): OverridePaint {
    const viewport = paneViewportFromInfo(info);
    const barCount = state.bars.length;
    const slot = barSlotWidth(viewport, barCount);
    const backgrounds: BackgroundBand[] = [];
    const bars: BarOverlayItem[] = [];
    // Index bars by time once so the per-bar overrides resolve in O(1).
    const byTime = new Map<number, Bar>();
    for (const bar of state.bars) byTime.set(bar.time, bar);
    for (const plot of state.plotOverlays.values()) {
        const { style } = plot;
        if (style.kind === "bg-color") {
            const paint = plot.colorValue === undefined ? style.color : plot.colorValue;
            if (paint === null) continue;
            const x = timeToX(plot.bar, viewport) - slot / 2;
            const alpha = 1 - (style.transp ?? 0) / 100;
            backgrounds.push({ x, width: slot, height: viewport.pxHeight, color: paint, alpha });
            continue;
        }
        const bar = byTime.get(plot.time);
        if (bar === undefined) continue;
        if (style.kind === "candle-override") {
            const openY = priceToY(bar.open, viewport);
            const closeY = priceToY(bar.close, viewport);
            const top = Math.min(openY, closeY);
            const bottom = Math.max(openY, closeY);
            let color: string;
            if (bar.close > bar.open) {
                color = style.bull;
            } else if (bar.close < bar.open) {
                color = style.bear;
            } else {
                color = style.doji ?? style.bull;
            }
            bars.push({
                kind: "candle",
                x: timeToX(plot.bar, viewport),
                bodyWidth: slot * BODY_WIDTH_RATIO,
                top,
                height: Math.max(1, bottom - top),
                color,
            });
            continue;
        }
        if (style.kind === "bar-override" || style.kind === "bar-color") {
            // `bar-color` prefers the per-bar `colorValue` over the static
            // `style.color`; a `null` gap paints nothing. `bar-override`
            // carries only `style.color`.
            const paint =
                style.kind === "bar-color" && plot.colorValue !== undefined
                    ? plot.colorValue
                    : style.color;
            if (paint === null) continue;
            bars.push({
                kind: "bar",
                x: timeToX(plot.bar, viewport),
                half: (slot * BODY_WIDTH_RATIO) / 2,
                highY: priceToY(bar.high, viewport),
                lowY: priceToY(bar.low, viewport),
                openY: priceToY(bar.open, viewport),
                closeY: priceToY(bar.close, viewport),
                color: paint,
            });
        }
    }
    return { backgrounds, bars };
}

/**
 * Resolve every buffered `horizontal-histogram` (volume-profile) emission into
 * right-edge {@link HistogramRow}s for the overlay pane, projected through the
 * overlay {@link Viewport}. Each row's `width` is `volume / maxVolume *
 * HORIZONTAL_HISTOGRAM_MAX_WIDTH_PX` and its `y` is the bucket price; the row
 * grows leftward from the plot's right edge. Mirrors the canvas2d reference's
 * `drawHorizontalHistogram` (`maxWidth = 96`, `rowHeight = 6`); a bucket's
 * `color` falls back to the palette's `plotDefault`. Returns `[]` when no
 * bucket carries positive volume.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { createAdapterState } from "chartlang-example-webgl-adapter";
 *     import { resolveHorizontalHistogram } from "chartlang-example-webgl-adapter";
 *     const state = createAdapterState();
 *     const rows = resolveHorizontalHistogram(state, {
 *         paneKey: "overlay",
 *         cssRect: { x: 0, y: 0, width: 800, height: 400 },
 *         window: { xMin: 0, xMax: 100, yMin: 1, yMax: 2 },
 *         ticks: { priceTicks: [], timeTicks: [] },
 *     });
 *     // rows.length === 0
 *     void rows;
 */
export function resolveHorizontalHistogram(
    state: AdapterState,
    info: AxisRenderInfo,
): ReadonlyArray<HistogramRow> {
    const viewport = paneViewportFromInfo(info);
    const rows: HistogramRow[] = [];
    for (const plot of state.plotOverlays.values()) {
        if (plot.style.kind !== "horizontal-histogram") continue;
        const { buckets } = plot.style;
        let maxVolume = 0;
        for (const bucket of buckets) {
            if (bucket.volume > maxVolume) maxVolume = bucket.volume;
        }
        if (maxVolume <= 0) continue;
        for (const bucket of buckets) {
            const width = (bucket.volume / maxVolume) * HORIZONTAL_HISTOGRAM_MAX_WIDTH_PX;
            const y = priceToY(bucket.price, viewport) - HORIZONTAL_HISTOGRAM_ROW_HEIGHT_PX / 2;
            rows.push({
                x: viewport.pxWidth - width,
                y,
                width,
                height: HORIZONTAL_HISTOGRAM_ROW_HEIGHT_PX,
                color: bucket.color ?? state.palette.plotDefault,
            });
        }
    }
    return rows;
}
