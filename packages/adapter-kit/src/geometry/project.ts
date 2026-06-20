// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { WorldPoint } from "@invinite-org/chartlang-core";

import type { Point2, Viewport } from "./types.js";

/**
 * Map a world time (UTC ms) to an x pixel coordinate. When `xMin ===
 * xMax` (single-bar viewport) the result pins to the canvas centre —
 * no NaN propagation. Ported verbatim from the canvas2d adapter's
 * `render/coords.ts` so every adapter projects time identically.
 *
 * @since 1.3
 * @stable
 * @example
 *     const x = timeToX(5, { xMin: 0, xMax: 10, yMin: 0, yMax: 1, pxWidth: 100, pxHeight: 1 });
 *     // x === 50
 *     void x;
 */
export function timeToX(time: number, view: Viewport): number {
    const span = view.xMax - view.xMin;
    if (span === 0) return view.pxWidth / 2;
    const normalised = (time - view.xMin) / span;
    return normalised * view.pxWidth;
}

/**
 * Map a world price to a y pixel coordinate. The y axis is flipped
 * (canvas y grows downward, prices grow upward), so a price at
 * `view.yMax` lands at `y = 0` and `view.yMin` lands at `y = pxHeight`.
 * The viewport is assumed non-degenerate (`yMax > yMin`); callers feed a
 * non-empty bar window. Ported verbatim from the canvas2d adapter's
 * `render/coords.ts`.
 *
 * @since 1.3
 * @stable
 * @example
 *     const y = priceToY(105, { xMin: 0, xMax: 1, yMin: 100, yMax: 110, pxWidth: 1, pxHeight: 100 });
 *     // y === 50
 *     void y;
 */
export function priceToY(price: number, view: Viewport): number {
    const span = view.yMax - view.yMin;
    const normalised = (price - view.yMin) / span;
    return view.pxHeight - normalised * view.pxHeight;
}

/**
 * Project a world `(time, price)` point to pixel `(x, y)` space by
 * composing {@link timeToX} and {@link priceToY}. Supersedes the
 * canvas2d adapter's `worldPointToCanvas`. Off-screen points are NOT
 * clipped — finite world inputs map to finite (possibly out-of-range)
 * pixels and the renderer clips at the stroke / fill boundary.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const view: Viewport;
 *     const anchor: WorldPoint = { time: 1_700_000_000_000, price: 105 };
 *     const px = worldPointToPixel(anchor, view);
 *     // px.x === timeToX(anchor.time, view); px.y === priceToY(anchor.price, view)
 *     void px;
 */
export function worldPointToPixel(p: WorldPoint, view: Viewport): Point2 {
    return { x: timeToX(p.time, view), y: priceToY(p.price, view) };
}
