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
 * @since 1.4
 * @stable
 * @example
 *     import { UPLOT_PRICE_SCALE } from "chartlang-example-uplot-adapter";
 *     // UPLOT_PRICE_SCALE === "y"
 *     void UPLOT_PRICE_SCALE;
 */
export const UPLOT_PRICE_SCALE = "y" as const;

// uPlot's x scale (time) is keyed `"x"`.
const UPLOT_TIME_SCALE = "x" as const;

/**
 * Build an adapter-kit {@link Viewport} from a live uPlot instance's
 * scales + plotting-area bbox, such that adapter-kit's `timeToX` /
 * `priceToY` over it REPRODUCE `u.valToPos(val, scaleKey, true)` once the
 * plotting-area offset returned by {@link offsetForViewport} is applied.
 *
 * uPlot's `valToPos(val, key, true)` returns a CANVAS (device) pixel — it
 * folds in the `bbox.left/top` plotting-area offset and is expressed in
 * canvas px (`bbox.width === plotWidthCss * devicePixelRatio`). The
 * `hooks.draw` ctx is that SAME unscaled device-px canvas (uPlot never
 * `ctx.scale`s — it pre-multiplies every coordinate by `pxRatio`). So the
 * viewport works directly in device px: `pxWidth = bbox.width` /
 * `pxHeight = bbox.height`, ranges from the scales, and the adapter shifts
 * the plotting-area-relative pixels by the device-px `bbox.left/top` offset
 * (`offsetForViewport`). Splitting the offset out (rather than baking
 * `bbox.left` into `xMin`) keeps `decomposeDrawing`'s output in the clean
 * plotting-area space the candle + hline pass also use. (An earlier
 * revision divided by `devicePixelRatio` to land in CSS px, which only
 * rendered correctly at dpr 1 — on a Retina display every ctx-drawn mark
 * collapsed into the top-left quarter; device px is uPlot's actual canvas
 * space.)
 *
 * @since 1.4
 * @stable
 * @example
 *     import { buildViewport } from "chartlang-example-uplot-adapter";
 *     declare const u: import("chartlang-example-uplot-adapter").UplotLike;
 *     const view = buildViewport(u);
 *     void view;
 */
export function buildViewport(u: UplotLike): Viewport {
    const x = u.scales[UPLOT_TIME_SCALE];
    const y = u.scales[UPLOT_PRICE_SCALE];
    return {
        xMin: x?.min ?? 0,
        xMax: x?.max ?? 1,
        yMin: y?.min ?? 0,
        yMax: y?.max ?? 1,
        pxWidth: u.bbox.width,
        pxHeight: u.bbox.height,
    };
}

/**
 * The device-px plotting-area offset the ctx is shifted by before painting
 * marks projected through {@link buildViewport}'s viewport, so the
 * plotting-area-relative pixels land at the same canvas pixel uPlot's
 * series occupy. `bbox.left/top` are already canvas (device) px — the same
 * space the `hooks.draw` ctx draws in — so they are used verbatim.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { offsetForViewport } from "chartlang-example-uplot-adapter";
 *     declare const u: import("chartlang-example-uplot-adapter").UplotLike;
 *     const { dx, dy } = offsetForViewport(u);
 *     void dx;
 *     void dy;
 */
export function offsetForViewport(u: UplotLike): { readonly dx: number; readonly dy: number } {
    return { dx: u.bbox.left, dy: u.bbox.top };
}
