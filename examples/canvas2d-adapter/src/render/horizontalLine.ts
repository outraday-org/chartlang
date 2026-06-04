// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { LineStyle } from "@invinite-org/chartlang-core";

import type { Palette } from "../palette";
import type { RenderCtx } from "./clear";
import { priceToY, type HLine, type Viewport } from "./coords";

function dashPattern(style: LineStyle): ReadonlyArray<number> {
    switch (style) {
        case "solid":
            return [];
        case "dashed":
            return [6, 4];
        case "dotted":
            return [2, 4];
    }
}

/**
 * Draw one horizontal line spanning the full canvas width at the
 * supplied price. The stroke style follows `hline.lineStyle` —
 * `"solid"` clears the dash array, `"dashed"` uses `[6, 4]`,
 * `"dotted"` uses `[2, 4]`. The line dash is reset to solid before
 * returning so downstream draws are not affected.
 *
 * @since 0.1
 * @experimental
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
