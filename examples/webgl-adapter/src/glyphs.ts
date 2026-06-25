// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Glyph + alert-badge POSITIONING for the 2D text overlay. Pure projection
// math (world bar point -> CSS-pixel anchor) + dispatch INTO the SHARED
// adapter-kit glyph geometry (`drawShape` / `drawCharacter` / `drawArrow` /
// `drawMarker` / `drawLabel`) — the glyph SHAPE geometry is the shared helper's
// responsibility, never re-derived here (byte-identical glyphs across the six
// adapters). Mirrors the uplot adapter's `paintGlyphMark` / `paintGlyph`
// dispatch exactly; the alert badge mirrors canvas2d's `drawAlertBadge`.

import {
    type AlertEmission,
    type PlotEmission,
    type PlotStyle,
    type Viewport,
    priceToY,
    timeToX,
} from "@invinite-org/chartlang-adapter-kit";
import {
    type RenderCtx,
    drawArrow,
    drawCharacter,
    drawLabel,
    drawMarker,
    drawShape,
} from "@invinite-org/chartlang-adapter-kit/canvas";
import type { Bar } from "@invinite-org/chartlang-core";

import type { AxisRenderInfo } from "./axes.js";
import type { Palette } from "./layer-descriptor.js";

// Null-color fallback for a glyph whose emission carries `color: null`. The
// palette's plot default — the same intent as the other adapters' glyph
// fallback (a visible default rather than transparent).
const GLYPH_DEFAULT_COLOR = "#90caf9";

const BADGE_RADIUS_PX = 4;
const TWO_PI = Math.PI * 2;

/**
 * A CSS-pixel anchor for an overlay glyph / badge — the projected `(x, y)` of a
 * bar point inside one pane's box.
 *
 * @since 0.1
 * @stable
 * @example
 *     const a: PixelAnchor = { x: 100, y: 50 };
 *     void a;
 */
export type PixelAnchor = {
    readonly x: number;
    readonly y: number;
};

/**
 * Build the CSS-pixel {@link Viewport} for one pane from its
 * {@link AxisRenderInfo} — the same projection the overlay's axis labels use
 * (world window + the pane's CSS box). Glyph / badge anchors project through
 * this with `timeToX` / `priceToY` then add the pane's `cssRect.{x,y}` origin.
 *
 * @since 0.1
 * @stable
 * @example
 *     const vp = paneViewportFromInfo({
 *         paneKey: "overlay",
 *         cssRect: { x: 0, y: 0, width: 800, height: 400 },
 *         window: { xMin: 0, xMax: 100, yMin: 1, yMax: 2 },
 *         ticks: { priceTicks: [], timeTicks: [] },
 *     });
 *     // vp.pxWidth === 800
 *     void vp;
 */
export function paneViewportFromInfo(info: AxisRenderInfo): Viewport {
    return {
        xMin: info.window.xMin,
        xMax: info.window.xMax,
        yMin: info.window.yMin,
        yMax: info.window.yMax,
        pxWidth: info.cssRect.width,
        pxHeight: info.cssRect.height,
    };
}

/**
 * Predicate selecting the glyph plot styles painted via the shared overlay
 * helper (`shape` / `character` / `arrow` / `marker` / `label`). The
 * substrate overlays (`bg-color` / `bar-color` / `candle-override` /
 * `bar-override` / `horizontal-histogram`) are NOT glyphs — they paint through
 * their own overlay substrate pass (`overrides.ts` / `paintOverlaySubstrate`,
 * Task 14), BEFORE the z-sorted glyph / drawing pass. The previously-dropped
 * `marker` style is included (parity).
 *
 * @since 0.1
 * @stable
 * @example
 *     isGlyphOverlay({ kind: "marker", shape: "circle", size: 6 }); // true
 *     isGlyphOverlay({ kind: "line" }); // false
 */
export function isGlyphOverlay(style: PlotStyle): boolean {
    return (
        style.kind === "shape" ||
        style.kind === "character" ||
        style.kind === "arrow" ||
        style.kind === "marker" ||
        style.kind === "label"
    );
}

/**
 * Project a glyph plot emission's SHIFTED bar point to a CSS-pixel anchor
 * inside the pane box. The world x is the shifted compressed bar slot
 * (`bar + xShift`, matching the series path), the world y is the plot `value`
 * (`priceToY`); the pane's `cssRect.{x,y}` origin is added so a sub-pane's
 * glyph lands in the right place. Returns `null` for a non-finite `value` (a
 * per-glyph skip, no paint), mirroring the uplot `paintGlyphMark` guard.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const emission: import("@invinite-org/chartlang-adapter-kit").PlotEmission;
 *     declare const info: AxisRenderInfo;
 *     declare const bars: ReadonlyArray<import("@invinite-org/chartlang-core").Bar>;
 *     const anchor = glyphAnchor(emission, info, bars, 60_000);
 *     void anchor;
 */
export function glyphAnchor(
    emission: PlotEmission,
    info: AxisRenderInfo,
    bars: ReadonlyArray<Bar>,
    spacing: number,
): PixelAnchor | null {
    void bars;
    void spacing;
    if (emission.value === null || !Number.isFinite(emission.value)) return null;
    const viewport = paneViewportFromInfo(info);
    const worldX = emission.bar + (emission.xShift ?? 0);
    const x = info.cssRect.x + timeToX(worldX, viewport);
    const y = info.cssRect.y + priceToY(emission.value, viewport);
    return { x, y };
}

/**
 * Dispatch one glyph emission to its shared adapter-kit renderer at the
 * resolved CSS-pixel anchor `(x, y)`. `emission.color` (the top-level emission
 * colour) is the glyph colour; a `null` falls back to {@link GLYPH_DEFAULT_COLOR}
 * inside the helper. `location` / `size` / shape / char / direction / text /
 * position come straight off the style — the geometry is the shared helper's
 * job. Byte-identical to the uplot adapter's `paintGlyph` (incl. the
 * conditional-`location` spread). A non-glyph style is a no-op (the caller
 * filters via {@link isGlyphOverlay}).
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const ctx: import("@invinite-org/chartlang-adapter-kit/canvas").RenderCtx;
 *     declare const emission: import("@invinite-org/chartlang-adapter-kit").PlotEmission;
 *     dispatchGlyph(ctx, emission, 100, 50);
 */
export function dispatchGlyph(ctx: RenderCtx, emission: PlotEmission, x: number, y: number): void {
    const { style } = emission;
    switch (style.kind) {
        case "shape":
            drawShape(
                ctx,
                {
                    x,
                    y,
                    shape: style.shape,
                    size: style.size,
                    ...(style.location === undefined ? {} : { location: style.location }),
                    color: emission.color,
                },
                GLYPH_DEFAULT_COLOR,
            );
            return;
        case "character":
            drawCharacter(
                ctx,
                {
                    x,
                    y,
                    char: style.char,
                    size: style.size,
                    ...(style.location === undefined ? {} : { location: style.location }),
                    color: emission.color,
                },
                GLYPH_DEFAULT_COLOR,
            );
            return;
        case "arrow":
            drawArrow(
                ctx,
                { x, y, direction: style.direction, size: style.size, color: emission.color },
                GLYPH_DEFAULT_COLOR,
            );
            return;
        case "marker":
            drawMarker(
                ctx,
                { x, y, shape: style.shape, size: style.size, color: emission.color },
                GLYPH_DEFAULT_COLOR,
            );
            return;
        case "label":
            drawLabel(
                ctx,
                { x, y, text: style.text, position: style.position, color: emission.color },
                GLYPH_DEFAULT_COLOR,
            );
            return;
        // No default: the caller only forwards the glyph subset (isGlyphOverlay),
        // so no other style kind reaches here.
    }
}

// Resolve the severity-coded badge colour from the palette (mirrors canvas2d's
// `colorFor`). The Palette's three alert slots map to the three severities.
function badgeColor(alert: AlertEmission, palette: Palette): string {
    switch (alert.severity) {
        case "info":
            return palette.alertInfo;
        case "warning":
            return palette.alertWarning;
        case "critical":
            return palette.alertCritical;
    }
}

/**
 * Project an alert's anchor bar to a CSS-pixel anchor: the badge sits at the
 * alert bar's `(time, high)`, falling back to the latest bar when the alert's
 * `bar` index is outside the rendered range (a host that trimmed history).
 * Returns `null` when there are no bars. Mirrors canvas2d's badge anchoring.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const alert: import("@invinite-org/chartlang-core").AlertEmission;
 *     declare const info: AxisRenderInfo;
 *     declare const bars: ReadonlyArray<import("@invinite-org/chartlang-core").Bar>;
 *     const anchor = alertBadgeAnchor(alert, info, bars);
 *     void anchor;
 */
export function alertBadgeAnchor(
    alert: AlertEmission,
    info: AxisRenderInfo,
    bars: ReadonlyArray<Bar>,
): PixelAnchor | null {
    if (bars.length === 0) return null;
    const anchorIndex = bars[alert.bar] === undefined ? bars.length - 1 : alert.bar;
    const anchorBar = bars[anchorIndex];
    const viewport = paneViewportFromInfo(info);
    const x = info.cssRect.x + timeToX(anchorIndex, viewport);
    const y = info.cssRect.y + priceToY(anchorBar.high, viewport);
    return { x, y };
}

/**
 * Paint one alert badge — a small filled circle at `anchor`, colour-coded by
 * the alert's severity (mirrors canvas2d's `drawAlertBadge`: exactly one `arc`
 * + `fill` per call). Defined locally rather than imported from canvas2d (the
 * no-cross-example-`src`-import invariant forbids it).
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const ctx: import("@invinite-org/chartlang-adapter-kit/canvas").RenderCtx;
 *     declare const alert: import("@invinite-org/chartlang-core").AlertEmission;
 *     declare const palette: Palette;
 *     paintAlertBadge(ctx, alert, { x: 100, y: 50 }, palette);
 */
export function paintAlertBadge(
    ctx: RenderCtx,
    alert: AlertEmission,
    anchor: PixelAnchor,
    palette: Palette,
): void {
    ctx.fillStyle = badgeColor(alert, palette);
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, BADGE_RADIUS_PX, 0, TWO_PI);
    ctx.closePath();
    ctx.fill();
}
