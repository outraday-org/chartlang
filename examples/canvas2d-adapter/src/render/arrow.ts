// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Palette } from "../palette";
import type { RenderCtx } from "./clear";

/**
 * Canvas coordinates and style for a Phase 5 `arrow` plot glyph.
 *
 * @since 0.5
 * @stable
 * @example
 *     const args: ArrowArgs = { x: 10, y: 20, direction: "up", size: 10, color: null };
 *     void args;
 */
export type ArrowArgs = {
    readonly x: number;
    readonly y: number;
    readonly direction: "up" | "down";
    readonly size: number;
    readonly color: string | null;
};

/**
 * Render a Phase-5 `arrow` plot as a filled triangle.
 *
 * @since 0.5
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const palette: Palette;
 *     drawArrow(ctx, { x: 10, y: 20, direction: "up", size: 10, color: null }, palette);
 */
export function drawArrow(ctx: RenderCtx, args: ArrowArgs, palette: Palette): void {
    const half = args.size / 2;
    ctx.fillStyle = args.color ?? palette.plotDefault;
    ctx.beginPath();
    if (args.direction === "up") {
        ctx.moveTo(args.x, args.y - half);
        ctx.lineTo(args.x + half, args.y + half);
        ctx.lineTo(args.x - half, args.y + half);
    } else {
        ctx.moveTo(args.x, args.y + half);
        ctx.lineTo(args.x + half, args.y - half);
        ctx.lineTo(args.x - half, args.y - half);
    }
    ctx.closePath();
    ctx.fill();
}
