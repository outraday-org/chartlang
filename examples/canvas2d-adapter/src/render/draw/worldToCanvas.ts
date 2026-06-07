// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { WorldPoint } from "@invinite-org/chartlang-core";

import { priceToY, timeToX, type Viewport } from "../coords";

/**
 * Project a world `(time, price)` point to canvas `(x, y)` pixel
 * space. Composes the existing {@link timeToX} and {@link priceToY}
 * helpers from `coords.ts` — `xMin`/`xMax` pin the visible time range
 * and `yMin`/`yMax` pin the visible price range; the y axis is
 * flipped (canvas y grows downward, prices grow upward).
 *
 * Off-screen points are **not** clipped — the projector returns finite
 * out-of-range pixel coordinates for finite world inputs and lets the
 * canvas2d context handle clipping at the stroke / fill boundary. This
 * matches the contract every Phase-3 drawing renderer (Tasks 5–18)
 * relies on.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const view: Viewport;
 *     const anchor: WorldPoint = { time: 1_700_000_000_000, price: 105 };
 *     const px = worldPointToCanvas(anchor, view);
 *     // px.x is `timeToX(anchor.time, view)`; px.y is `priceToY(anchor.price, view)`.
 *     void px;
 */
export function worldPointToCanvas(p: WorldPoint, view: Viewport): { x: number; y: number } {
    return { x: timeToX(p.time, view), y: priceToY(p.price, view) };
}
