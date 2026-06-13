// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Palette } from "../palette.js";
import type { RenderCtx } from "./clear.js";
import type { PaneRect } from "./paneLayout.js";

/**
 * Fill a pane rect with the palette's background colour. Used by
 * the per-pane render walk to clear each pane independently before
 * drawing its content (so subpanes don't bleed into the price
 * pane and vice versa).
 *
 * @since 0.2
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const palette: Palette;
 *     clearPaneRect(ctx, { x: 0, y: 0, w: 800, h: 280 }, palette);
 *     void clearPaneRect;
 */
export function clearPaneRect(ctx: RenderCtx, rect: PaneRect, palette: Palette): void {
    ctx.fillStyle = palette.background;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}
