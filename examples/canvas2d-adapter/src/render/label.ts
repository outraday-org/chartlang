// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Palette } from "../palette";
import type { RenderCtx } from "./clear";

/**
 * Position the label sits in relative to the (`x`, `y`) anchor.
 *
 * - `above` → text sits above the anchor (`textBaseline = "bottom"`).
 * - `below` → text sits below the anchor (`textBaseline = "top"`).
 * - `anchor` → text is vertically centred on the anchor
 *   (`textBaseline = "middle"`).
 *
 * @since 0.2
 * @experimental
 * @example
 *     const p: LabelPosition = "above";
 *     void p;
 */
export type LabelPosition = "above" | "below" | "anchor";

/**
 * Inputs for {@link drawLabel}. World-space `x` / `y` are CSS pixels
 * the caller derives via `timeToX` / `priceToY`. `font` defaults to
 * the Canvas 2D default `"10px sans-serif"` when omitted.
 *
 * @since 0.2
 * @experimental
 * @example
 *     const args: LabelArgs = {
 *         x: 100, y: 50, text: "PEAK", position: "above", color: "#26a69a",
 *     };
 *     void args;
 */
export type LabelArgs = {
    readonly x: number;
    readonly y: number;
    readonly text: string;
    readonly position: LabelPosition;
    readonly color: string | null;
    readonly font?: string;
};

const DEFAULT_FONT = "10px sans-serif";

function baselineFor(position: LabelPosition): "top" | "middle" | "bottom" {
    switch (position) {
        case "above":
            return "bottom";
        case "below":
            return "top";
        case "anchor":
            return "middle";
    }
}

/**
 * Render a single text annotation at (`x`, `y`). The renderer sets
 * `fillStyle`, `font`, `textAlign = "center"`, and a
 * `position`-dependent `textBaseline`, then calls `fillText`. A null
 * `color` falls back to `palette.plotDefault`.
 *
 * @since 0.2
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const palette: Palette;
 *     drawLabel(ctx, {
 *         x: 100, y: 50, text: "PEAK", position: "above", color: "#26a69a",
 *     }, palette);
 *     void drawLabel;
 */
export function drawLabel(ctx: RenderCtx, args: LabelArgs, palette: Palette): void {
    ctx.fillStyle = args.color ?? palette.plotDefault;
    ctx.font = args.font ?? DEFAULT_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = baselineFor(args.position);
    ctx.fillText(args.text, args.x, args.y);
}
