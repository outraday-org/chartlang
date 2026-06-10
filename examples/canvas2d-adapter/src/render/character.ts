// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Palette } from "../palette";
import type { RenderCtx } from "./clear";
import type { PlotLocation } from "./plotLocation";

/**
 * Canvas coordinates and glyph data for a Phase 5 `character` plot.
 *
 * @since 0.5
 * @stable
 * @example
 *     const args: CharacterArgs = { x: 10, y: 20, char: "A", size: 12, color: null };
 *     void args;
 */
export type CharacterArgs = {
    readonly x: number;
    readonly y: number;
    readonly char: string;
    readonly size: number;
    readonly location?: PlotLocation;
    readonly color: string | null;
};

function anchor(args: CharacterArgs): {
    readonly y: number;
    readonly baseline: RenderCtx["textBaseline"];
} {
    switch (args.location ?? "absolute") {
        case "above":
            return { y: args.y - args.size, baseline: "bottom" };
        case "below":
            return { y: args.y + args.size, baseline: "top" };
        case "absolute":
            return { y: args.y, baseline: "middle" };
    }
}

/**
 * Render a Phase-5 `character` plot glyph as canvas text.
 *
 * @since 0.5
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const palette: Palette;
 *     drawCharacter(ctx, { x: 10, y: 20, char: "A", size: 12, color: null }, palette);
 */
export function drawCharacter(ctx: RenderCtx, args: CharacterArgs, palette: Palette): void {
    const resolved = anchor(args);
    ctx.fillStyle = args.color ?? palette.plotDefault;
    ctx.font = `${args.size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = resolved.baseline;
    ctx.fillText(args.char, args.x, resolved.y);
}
