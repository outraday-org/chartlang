// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Palette } from "../palette";
import type { RenderCtx } from "./clear";
import { drawMarker } from "./marker";
import type { PlotLocation } from "./plotLocation";

/**
 * Canvas glyph inventory for Phase 5 `shape` plots.
 *
 * @since 0.5
 * @stable
 * @example
 *     const glyph: ShapeGlyph = "cross";
 *     void glyph;
 */
export type ShapeGlyph =
    | "circle"
    | "triangle-up"
    | "triangle-down"
    | "square"
    | "diamond"
    | "cross"
    | "xcross"
    | "flag";

/**
 * Canvas coordinates and style for a Phase 5 `shape` plot glyph.
 *
 * @since 0.5
 * @stable
 * @example
 *     const args: ShapeArgs = { x: 10, y: 20, shape: "cross", size: 8, color: null };
 *     void args;
 */
export type ShapeArgs = {
    readonly x: number;
    readonly y: number;
    readonly shape: ShapeGlyph;
    readonly size: number;
    readonly location?: PlotLocation;
    readonly color: string | null;
};

const OFFSET_RATIO = 1.25;

function anchoredY(args: ShapeArgs): number {
    switch (args.location ?? "absolute") {
        case "above":
            return args.y - args.size * OFFSET_RATIO;
        case "below":
            return args.y + args.size * OFFSET_RATIO;
        case "absolute":
            return args.y;
    }
}

/**
 * Render a Phase-5 `shape` glyph at a plot anchor.
 *
 * @since 0.5
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const palette: Palette;
 *     drawShape(ctx, { x: 10, y: 20, shape: "cross", size: 8, color: null }, palette);
 */
export function drawShape(ctx: RenderCtx, args: ShapeArgs, palette: Palette): void {
    const y = anchoredY(args);
    if (
        args.shape === "circle" ||
        args.shape === "triangle-up" ||
        args.shape === "triangle-down" ||
        args.shape === "square" ||
        args.shape === "diamond"
    ) {
        drawMarker(ctx, { ...args, y, shape: args.shape }, palette);
        return;
    }

    ctx.strokeStyle = args.color ?? palette.plotDefault;
    ctx.lineWidth = 1;
    const half = args.size / 2;
    switch (args.shape) {
        case "cross":
            ctx.beginPath();
            ctx.moveTo(args.x - half, y);
            ctx.lineTo(args.x + half, y);
            ctx.moveTo(args.x, y - half);
            ctx.lineTo(args.x, y + half);
            ctx.stroke();
            return;
        case "xcross":
            ctx.beginPath();
            ctx.moveTo(args.x - half, y - half);
            ctx.lineTo(args.x + half, y + half);
            ctx.moveTo(args.x + half, y - half);
            ctx.lineTo(args.x - half, y + half);
            ctx.stroke();
            return;
        case "flag":
            ctx.beginPath();
            ctx.moveTo(args.x - half, y + half);
            ctx.lineTo(args.x - half, y - half);
            ctx.lineTo(args.x + half, y - half / 2);
            ctx.lineTo(args.x - half, y);
            ctx.stroke();
            return;
    }
}
