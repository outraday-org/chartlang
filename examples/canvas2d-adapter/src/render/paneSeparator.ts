// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Palette } from "../palette.js";
import type { RenderCtx } from "./clear.js";
import type { PaneRect } from "./paneLayout.js";

/**
 * Draw a 1px horizontal divider at the top of a subpane rect.
 * Visually separates the subpane from the pane above it (price
 * pane or another subpane). The `+ 0.5` offset keeps the line crisp
 * on integer-aligned canvases (standard HTML canvas half-pixel
 * convention).
 *
 * @since 0.2
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const palette: Palette;
 *     drawPaneSeparator(ctx, { x: 0, y: 280, w: 800, h: 120 }, palette);
 *     void drawPaneSeparator;
 */
export function drawPaneSeparator(ctx: RenderCtx, rect: PaneRect, palette: Palette): void {
    ctx.strokeStyle = palette.paneBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y + 0.5);
    ctx.lineTo(rect.x + rect.w, rect.y + 0.5);
    ctx.stroke();
}
