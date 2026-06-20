// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Viewport } from "@invinite-org/chartlang-adapter-kit";

import type { UplotLike } from "./createUplotAdapter.js";

/**
 * The scale key uPlot ranges price against. uPlot's default y scale is
 * keyed `"y"`; the adapter pins each pane's price range onto it
 * (`setScale("y", …)`), so drawings + horizontal lines project off the
 * same scale the series use.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { UPLOT_PRICE_SCALE } from "chartlang-example-uplot-adapter";
 *     // UPLOT_PRICE_SCALE === "y"
 *     void UPLOT_PRICE_SCALE;
 */
export const UPLOT_PRICE_SCALE = "y" as const;

// uPlot's x scale (time) is keyed `"x"`.
const UPLOT_TIME_SCALE = "x" as const;

// devicePixelRatio in a headless (Node) test run is undefined; uPlot
// itself defaults the same way. CSS px == canvas px when it is 1, which
// is what the MockUplot's bbox/scales assume.
function dpr(): number {
    const ratio = typeof globalThis.devicePixelRatio === "number" ? globalThis.devicePixelRatio : 1;
    return ratio > 0 ? ratio : 1;
}

/**
 * Build an adapter-kit {@link Viewport} from a live uPlot instance's
 * scales + plotting-area bbox, such that adapter-kit's `timeToX` /
 * `priceToY` over it REPRODUCE `u.valToPos(val, scaleKey, true)` once the
 * plotting-area offset returned by {@link offsetForViewport} is applied to
 * the canvas.
 *
 * uPlot's `valToPos(val, key, true)` returns a CANVAS pixel — it folds in
 * the `bbox.left/top` plotting-area offset and is expressed in canvas px
 * (scaled by `devicePixelRatio`). adapter-kit's projection starts at the
 * plotting-area origin `(0, 0)` and works in CSS px. So the viewport
 * carries `pxWidth = bbox.width / dpr` / `pxHeight = bbox.height / dpr`
 * (CSS px, plotting-area space) and the adapter translates the ctx by the
 * CSS-px `bbox.left/top` offset around the drawing pass — the same canvas
 * pixel uPlot's series land on. Splitting the offset out (rather than
 * baking `bbox.left` into `xMin`) keeps `decomposeDrawing`'s output in the
 * clean plotting-area space the candle + hline pass already use.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { buildViewport } from "chartlang-example-uplot-adapter";
 *     declare const u: import("chartlang-example-uplot-adapter").UplotLike;
 *     const view = buildViewport(u);
 *     void view;
 */
export function buildViewport(u: UplotLike): Viewport {
    const ratio = dpr();
    const x = u.scales[UPLOT_TIME_SCALE];
    const y = u.scales[UPLOT_PRICE_SCALE];
    return {
        xMin: x?.min ?? 0,
        xMax: x?.max ?? 1,
        yMin: y?.min ?? 0,
        yMax: y?.max ?? 1,
        pxWidth: u.bbox.width / ratio,
        pxHeight: u.bbox.height / ratio,
    };
}

/**
 * The CSS-px plotting-area offset to translate the canvas by before
 * painting decomposed drawings, so plotting-area-relative pixels (what
 * {@link buildViewport}'s viewport produces) land at the same canvas pixel
 * uPlot's series occupy. `bbox.left/top` are canvas px, so they are
 * divided by `devicePixelRatio` to match the CSS-px viewport.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { offsetForViewport } from "chartlang-example-uplot-adapter";
 *     declare const u: import("chartlang-example-uplot-adapter").UplotLike;
 *     const { dx, dy } = offsetForViewport(u);
 *     void dx;
 *     void dy;
 */
export function offsetForViewport(u: UplotLike): { readonly dx: number; readonly dy: number } {
    const ratio = dpr();
    return { dx: u.bbox.left / ratio, dy: u.bbox.top / ratio };
}
