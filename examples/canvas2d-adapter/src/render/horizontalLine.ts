// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Palette } from "../palette.js";
import type { RenderCtx } from "./clear.js";
import { priceToY, type HLine, type Viewport } from "./coords.js";
import { dashPattern } from "./lineDash.js";

/**
 * Draw one horizontal line spanning the full canvas width at the
 * supplied price. The stroke style follows `hline.lineStyle` —
 * `"solid"` clears the dash array, `"dashed"` uses `[6, 4]`,
 * `"dotted"` uses `[2, 4]`. The line dash is reset to solid before
 * returning so downstream draws are not affected.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const hline: HLine;
 *     declare const vp: Viewport;
 *     declare const p: Palette;
 *     drawHorizontalLine(ctx, hline, vp, p);
 *     void drawHorizontalLine;
 */
export function drawHorizontalLine(
    ctx: RenderCtx,
    hline: HLine,
    viewport: Viewport,
    palette: Palette,
): void {
    const y = priceToY(hline.price, viewport);
    ctx.strokeStyle = hline.color ?? palette.plotDefault;
    ctx.lineWidth = hline.lineWidth;
    ctx.setLineDash(dashPattern(hline.lineStyle));
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(viewport.pxWidth, y);
    ctx.stroke();
    ctx.setLineDash([]);
}
