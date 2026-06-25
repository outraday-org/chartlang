// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Pure CSS-pixel subpane layout — no GL, no DOM. Splits the canvas into one
// overlay (price) pane plus stacked subpanes, mirroring the canvas2d
// reference adapter's `computePaneLayout` policy byte-for-concept so the two
// adapters frame the same panes. Node-unit-tested headlessly.

import type { PaneLayoutRect } from "./buildFrame.js";

/**
 * Fraction of the canvas height the overlay (price) pane takes when at least
 * one subpane exists; the subpanes share the remaining `1 - PRICE_PANE_FRACTION`.
 * Matches the canvas2d reference's constant so both adapters stack panes the
 * same way.
 *
 * @since 0.1
 * @stable
 * @example
 *     PRICE_PANE_FRACTION === 0.8;
 */
export const PRICE_PANE_FRACTION = 0.8;

/**
 * Split a canvas into one overlay (price) pane plus N stacked subpanes, in
 * `paneOrder` order. The overlay pane (`"overlay"`, always index 0) takes the
 * top {@link PRICE_PANE_FRACTION} of the height; the subpanes share the bottom
 * band uniformly, the LAST subpane absorbing the integer-rounding remainder so
 * the panes tile the canvas exactly (no 1-px seam). With zero subpanes the
 * overlay pane spans the full canvas — the Task-5 single-overlay MVP layout,
 * now the zero-subpane case of this general split.
 *
 * Each entry is a CSS-px {@link PaneLayoutRect} the renderer's `paneViewport`
 * rounds to a device-px GL viewport (the single CSS→device rounding site).
 * Pure — `paneOrder` + canvas dims in, rects out; no GL, no DOM, no clip
 * space. Mirrors the canvas2d reference's `computePaneLayout`.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { computePaneLayout } from "chartlang-example-webgl-adapter";
 *     const rects = computePaneLayout(["overlay", "rsi"], 800, 400);
 *     // rects[0] = { paneKey: "overlay", x: 0, y: 0, width: 800, height: 320 }
 *     // rects[1] = { paneKey: "rsi",     x: 0, y: 320, width: 800, height: 80 }
 *     void rects;
 */
export function computePaneLayout(
    paneOrder: ReadonlyArray<string>,
    cssWidth: number,
    cssHeight: number,
): PaneLayoutRect[] {
    const subpaneKeys = paneOrder.filter((k) => k !== "overlay");
    if (subpaneKeys.length === 0) {
        return [{ paneKey: "overlay", x: 0, y: 0, width: cssWidth, height: cssHeight }];
    }
    const priceHeight = Math.floor(cssHeight * PRICE_PANE_FRACTION);
    const subpaneBand = cssHeight - priceHeight;
    const subpaneHeight = Math.floor(subpaneBand / subpaneKeys.length);
    const rects: PaneLayoutRect[] = [
        { paneKey: "overlay", x: 0, y: 0, width: cssWidth, height: priceHeight },
    ];
    let y = priceHeight;
    subpaneKeys.forEach((paneKey, i) => {
        const last = i === subpaneKeys.length - 1;
        const height = last ? cssHeight - y : subpaneHeight;
        rects.push({ paneKey, x: 0, y, width: cssWidth, height });
        y += height;
    });
    return rects;
}
