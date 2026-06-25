// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    type AlertEmission,
    type DrawPrimitive,
    type PlotEmission,
    type Viewport,
    priceToY,
    timeToX,
} from "@invinite-org/chartlang-adapter-kit";
import { type RenderCtx, paintPrimitive } from "@invinite-org/chartlang-adapter-kit/canvas";

import { type AxisRenderInfo, formatPrice, formatTime } from "./axes.js";
import { type PixelAnchor, dispatchGlyph, paintAlertBadge } from "./glyphs.js";
import type { Palette } from "./layer-descriptor.js";
import type { BackgroundBand, BarOverlayItem, HistogramRow } from "./overrides.js";

const AXIS_FONT = "10px sans-serif";
// Right-gutter gap between the plot edge and a price label (canvas2d parity).
const PRICE_LABEL_GAP_PX = 6;
// Bottom gap below the plot for the time-axis row.
const TIME_LABEL_GAP_PX = 4;

/**
 * A single piece of overlay text anchored at a CSS-pixel `(x, y)`. The
 * low-level paint unit {@link TextOverlay.paintText} consumes — the axis-label
 * pass builds these from the projected ticks, and Task 12 (cursor / marker /
 * alert badges) will feed its own glyph labels through the same API. `align` /
 * `baseline` map straight onto the {@link RenderCtx} text setters.
 *
 * @since 0.1
 * @stable
 * @example
 *     const t: OverlayText = { x: 10, y: 20, text: "72.50", color: "#ccc" };
 *     void t;
 */
export type OverlayText = {
    readonly x: number;
    readonly y: number;
    readonly text: string;
    readonly color: string;
    readonly align?: RenderCtx["textAlign"];
    readonly baseline?: RenderCtx["textBaseline"];
};

/**
 * One glyph to paint on the overlay: a resolved CSS-pixel {@link PixelAnchor}
 * + the glyph plot {@link PlotEmission} it came from. {@link TextOverlay.paintGlyphs}
 * dispatches each into the SHARED adapter-kit glyph geometry (`drawShape` /
 * `drawCharacter` / `drawArrow` / `drawMarker` / `drawLabel`) — the anchor
 * projection lives in `glyphs.ts` (pure), the geometry is the shared helper's.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const emission: import("@invinite-org/chartlang-adapter-kit").PlotEmission;
 *     const item: GlyphPaintItem = { emission, anchor: { x: 100, y: 50 } };
 *     void item;
 */
export type GlyphPaintItem = {
    readonly emission: PlotEmission;
    readonly anchor: PixelAnchor;
};

/**
 * One alert badge to paint on the overlay: a resolved CSS-pixel
 * {@link PixelAnchor} + the {@link AlertEmission} it came from (the badge
 * colour is severity-coded from the palette).
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const alert: import("@invinite-org/chartlang-adapter-kit").AlertEmission;
 *     const item: AlertBadgePaintItem = { alert, anchor: { x: 100, y: 50 } };
 *     void item;
 */
export type AlertBadgePaintItem = {
    readonly alert: AlertEmission;
    readonly anchor: PixelAnchor;
};

/**
 * The 2D-canvas text overlay: a thin sibling `<canvas>` layered over the GL
 * canvas that paints axis labels (and, from Task 12, drawing / marker / alert
 * text). The split is deliberate — the GL canvas paints geometry (candles,
 * lines, the grid line-strip); the overlay paints text, which a GPU glyph atlas
 * cannot match for crispness at this MVP tier. Sized to the GL canvas's CSS box
 * × dpr so labels stay HiDPI-sharp; `setTransform(dpr, …)` lets every paint use
 * CSS-pixel coordinates.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { createTextOverlay } from "chartlang-example-webgl-adapter";
 *     declare const ctx: import("@invinite-org/chartlang-adapter-kit/canvas").RenderCtx;
 *     const overlay = createTextOverlay({ ctx, cssWidth: 800, cssHeight: 400, dpr: 1 });
 *     overlay.clear();
 *     void overlay;
 */
export type TextOverlay = {
    /** Clear the whole overlay (called once per frame before the label pass). */
    clear(): void;
    /** Paint a batch of text items in CSS-pixel space. */
    paintText(items: ReadonlyArray<OverlayText>): void;
    /**
     * Paint a batch of glyph plot marks (`shape` / `character` / `arrow` /
     * `marker` / `label`) through the SHARED adapter-kit glyph geometry. The
     * caller resolves each {@link GlyphPaintItem}'s CSS-pixel anchor (via
     * `glyphs.ts`'s pure `glyphAnchor`); this paints the shape at it.
     */
    paintGlyphs(items: ReadonlyArray<GlyphPaintItem>): void;
    /**
     * Paint a batch of severity-coded alert badges (a small filled circle per
     * alert at its resolved anchor). The caller resolves each anchor via
     * `glyphs.ts`'s `alertBadgeAnchor`.
     */
    paintAlertBadges(items: ReadonlyArray<AlertBadgePaintItem>, palette: Palette): void;
    /**
     * Paint a batch of drawing primitives (the flat
     * {@link import("@invinite-org/chartlang-adapter-kit").DrawPrimitive} list
     * the shared `decomposeDrawing` reduces every `draw.*` kind to) through the
     * SHARED `paintPrimitive` canvas sink — byte-identical to canvas2d / uplot /
     * lightweight-charts. The caller builds the pixel-space primitives via
     * `drawings.ts`'s `drawingPrimitives` (the overlay-pane projection); this
     * paints polyline / arc / text / marker shapes natively, so no GL
     * tessellation is needed.
     */
    paintDrawings(prims: ReadonlyArray<DrawPrimitive>): void;
    /**
     * Paint translucent `bg-color` background bands — substrate painted BEFORE
     * the z-sorted glyph / drawing pass (the canvas2d `renderBackgroundOverlays`
     * order). Each band fills the pane height at its resolved CSS-px `x` /
     * `width` / `alpha`. The caller resolves the bands via `overrides.ts`'s
     * `resolveOverridePaint`.
     */
    paintBackgroundOverlays(bands: ReadonlyArray<BackgroundBand>): void;
    /**
     * Paint per-bar candle / bar overrides (`candle-override` /
     * `bar-override` / `bar-color`) — substrate painted over the GL candles,
     * before the z-sorted pass (the canvas2d `renderBarOverlays` order). The
     * caller resolves the items via `overrides.ts`'s `resolveOverridePaint`.
     */
    paintBarOverlays(items: ReadonlyArray<BarOverlayItem>): void;
    /**
     * Paint right-edge horizontal-volume rows (`horizontal-histogram`) — the
     * volume-profile substrate. The caller resolves the rows via `overrides.ts`'s
     * `resolveHorizontalHistogram`.
     */
    paintHorizontalHistogram(rows: ReadonlyArray<HistogramRow>): void;
    /**
     * Project + paint one pane's axis labels: right-gutter price labels at each
     * price tick, bottom-row time labels at each time tick. Pure mapping over
     * the {@link AxisRenderInfo} the renderer's `onAxes` hook supplies.
     */
    paintAxisLabels(info: AxisRenderInfo, palette: Palette): void;
    /** Re-size the backing canvas to a new CSS box / dpr (browser-only). */
    resize(cssWidth: number, cssHeight: number, dpr: number): void;
    /** Release the overlay (detach the canvas element if the overlay owns it). */
    dispose(): void;
};

/**
 * Build the CSS-pixel {@link OverlayText} labels for one pane's axes from its
 * {@link AxisRenderInfo}. Pure (no `RenderCtx`, no DOM) so the projection is
 * unit-tested headlessly: each price tick projects through `priceToY` into a
 * right-gutter label; each time tick through `timeToX` into a bottom-row label.
 * Ticks outside the pane's pixel box are dropped. The pane's `cssRect.{x,y}`
 * offset is added so a sub-pane's labels land in the right place.
 *
 * @since 0.1
 * @stable
 * @example
 *     const labels = axisLabelItems(
 *         {
 *             paneKey: "overlay",
 *             cssRect: { x: 0, y: 0, width: 800, height: 400 },
 *             window: { xMin: 0, xMax: 100, yMin: 1, yMax: 2 },
 *             ticks: { priceTicks: [1, 1.5, 2], timeTicks: [0, 50, 100] },
 *         },
 *         "#cccccc",
 *     );
 *     // labels.length === 6
 *     void labels;
 */
export function axisLabelItems(info: AxisRenderInfo, labelColor: string): OverlayText[] {
    const { cssRect, window: win, ticks } = info;
    const viewport: Viewport = {
        xMin: win.xMin,
        xMax: win.xMax,
        yMin: win.yMin,
        yMax: win.yMax,
        pxWidth: cssRect.width,
        pxHeight: cssRect.height,
    };
    const items: OverlayText[] = [];
    const span = win.yMax - win.yMin;
    for (const price of ticks.priceTicks) {
        const localY = priceToY(price, viewport);
        if (localY < 0 || localY > cssRect.height) continue;
        // Pin the top / bottom edge labels just inside the pane so they are not
        // clipped (canvas2d parity).
        const baseline: RenderCtx["textBaseline"] =
            localY <= 1 ? "top" : localY >= cssRect.height - 1 ? "bottom" : "middle";
        const text = formatPrice(price, span);
        if (text === "") continue;
        items.push({
            x: cssRect.x + cssRect.width + PRICE_LABEL_GAP_PX,
            y: cssRect.y + localY,
            text,
            color: labelColor,
            align: "left",
            baseline,
        });
    }
    const spanMs = win.xMax - win.xMin;
    for (const time of ticks.timeTicks) {
        const localX = timeToX(time, viewport);
        if (localX < 0 || localX > cssRect.width) continue;
        const text = formatTime(time, spanMs);
        if (text === "") continue;
        items.push({
            x: cssRect.x + localX,
            y: cssRect.y + cssRect.height + TIME_LABEL_GAP_PX,
            text,
            color: labelColor,
            align: "center",
            baseline: "top",
        });
    }
    return items;
}

/**
 * Construct a {@link TextOverlay} over an injected {@link RenderCtx}. The
 * factory is context-driven so it is headless-testable: a test passes a
 * `RenderCtx` stub (recording `fillText` calls); production passes a real
 * `<canvas>` 2D context. When `canvas` is supplied the overlay owns its DPR
 * sizing + `dispose` detach; with only a `ctx` it paints but does not size /
 * detach (the test owns the stub).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { createTextOverlay } from "chartlang-example-webgl-adapter";
 *     declare const ctx: import("@invinite-org/chartlang-adapter-kit/canvas").RenderCtx;
 *     const overlay = createTextOverlay({ ctx, cssWidth: 320, cssHeight: 240, dpr: 1 });
 *     overlay.paintText([{ x: 4, y: 12, text: "hi", color: "#fff" }]);
 *     void overlay;
 */
export function createTextOverlay(opts: {
    readonly ctx: RenderCtx;
    readonly cssWidth: number;
    readonly cssHeight: number;
    readonly dpr: number;
    /** Owned overlay canvas (production); omit for the ctx-only test seam. */
    readonly canvas?: HTMLCanvasElement;
}): TextOverlay {
    const { ctx } = opts;
    let cssWidth = opts.cssWidth;
    let cssHeight = opts.cssHeight;
    let dpr = opts.dpr;
    const canvas = opts.canvas;

    return {
        clear(): void {
            // Reset to identity, clear the full backing store, then re-apply the
            // dpr transform so paints use CSS-px coordinates.
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, cssWidth * dpr, cssHeight * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        },
        paintText(items): void {
            ctx.font = AXIS_FONT;
            for (const item of items) {
                ctx.fillStyle = item.color;
                ctx.textAlign = item.align ?? "left";
                ctx.textBaseline = item.baseline ?? "alphabetic";
                ctx.fillText(item.text, item.x, item.y);
            }
        },
        paintGlyphs(items): void {
            for (const item of items) {
                dispatchGlyph(ctx, item.emission, item.anchor.x, item.anchor.y);
            }
        },
        paintAlertBadges(items, palette): void {
            for (const item of items) {
                paintAlertBadge(ctx, item.alert, item.anchor, palette);
            }
        },
        paintDrawings(prims): void {
            for (const prim of prims) {
                paintPrimitive(ctx, prim);
            }
        },
        paintBackgroundOverlays(bands): void {
            for (const band of bands) {
                ctx.globalAlpha = band.alpha;
                ctx.fillStyle = band.color;
                ctx.fillRect(band.x, 0, band.width, band.height);
            }
            ctx.globalAlpha = 1;
        },
        paintBarOverlays(items): void {
            for (const item of items) {
                if (item.kind === "candle") {
                    ctx.fillStyle = item.color;
                    ctx.fillRect(
                        item.x - item.bodyWidth / 2,
                        item.top,
                        item.bodyWidth,
                        item.height,
                    );
                    continue;
                }
                // OHLC bar outline: high→low spine + left open tick + right
                // close tick (canvas2d `drawBarOverride` geometry).
                ctx.strokeStyle = item.color;
                ctx.beginPath();
                ctx.moveTo(item.x, item.highY);
                ctx.lineTo(item.x, item.lowY);
                ctx.moveTo(item.x - item.half, item.openY);
                ctx.lineTo(item.x, item.openY);
                ctx.moveTo(item.x, item.closeY);
                ctx.lineTo(item.x + item.half, item.closeY);
                ctx.stroke();
            }
        },
        paintHorizontalHistogram(rows): void {
            for (const row of rows) {
                ctx.fillStyle = row.color;
                ctx.fillRect(row.x, row.y, row.width, row.height);
            }
        },
        paintAxisLabels(info, palette): void {
            this.paintText(axisLabelItems(info, palette.candleWick));
        },
        /* v8 ignore start -- DOM sizing is browser-only; the ctx-only test seam skips it */
        resize(nextCssWidth, nextCssHeight, nextDpr): void {
            cssWidth = nextCssWidth;
            cssHeight = nextCssHeight;
            dpr = nextDpr;
            if (canvas !== undefined) {
                canvas.width = Math.round(cssWidth * dpr);
                canvas.height = Math.round(cssHeight * dpr);
                canvas.style.width = `${cssWidth}px`;
                canvas.style.height = `${cssHeight}px`;
            }
        },
        dispose(): void {
            if (canvas !== undefined) canvas.remove();
        },
        /* v8 ignore stop */
    };
}
