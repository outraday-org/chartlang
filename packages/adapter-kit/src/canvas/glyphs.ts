// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { RenderCtx } from "./renderCtx.js";

// Shared, model-free glyph geometry for the canvas-family adapters (uplot
// draw-hook, lightweight-charts overlay). Promoted out of the canvas2d
// reference adapter's `render/{shape,character,arrow,marker,label}.ts` so the
// `shape` / `character` / `arrow` / `marker` / `label` geometry is written ONCE
// instead of hand-ported per consumer (the bug class the `shift.ts` /
// `renderOrder.ts` promotions exist to kill). Each helper draws onto a
// `RenderCtx` and takes a plain `fallbackColor: string` (the null-color
// default), so it carries no palette / library / model types — the move is a
// pure RenderCtx-based promotion. canvas2d keeps its own `Palette`-taking
// local renderers (re-consume deferred).

const OFFSET_RATIO = 1.25;
const TWO_PI = Math.PI * 2;
const DEFAULT_LABEL_FONT = "10px sans-serif";

/**
 * Vertical anchoring mode shared by the `shape` / `character` glyphs.
 * `above` / `below` offset the glyph relative to the plot value; `absolute`
 * pins it at the value.
 *
 * @since 1.7
 * @stable
 * @example
 *     const location: GlyphLocation = "below";
 *     void location;
 */
export type GlyphLocation = "above" | "below" | "absolute";

/**
 * Inventory of `shape` glyphs (Pine `plotshape`). The first five reuse the
 * filled {@link drawMarker} geometry; `cross` / `xcross` / `flag` are
 * stroke-only.
 *
 * @since 1.7
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
 * Inputs for {@link drawShape}. World-space `x` / `y` are pixels the caller
 * derives via `timeToX` / `priceToY`; `size` is the glyph bounding-box edge
 * length in pixels.
 *
 * @since 1.7
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
    readonly location?: GlyphLocation;
    readonly color: string | null;
};

/**
 * Discrete marker glyph. Matches the `marker` variant of `PlotStyle.shape`.
 *
 * @since 1.7
 * @stable
 * @example
 *     const s: MarkerShape = "triangle-up";
 *     void s;
 */
export type MarkerShape = "circle" | "triangle-up" | "triangle-down" | "square" | "diamond";

/**
 * Inputs for {@link drawMarker}. World-space `x` / `y` are pixels the caller
 * derives via `timeToX` / `priceToY`; `size` is the glyph's bounding-box edge
 * length in pixels (the circle uses `size` as its diameter).
 *
 * @since 1.7
 * @stable
 * @example
 *     const args: MarkerArgs = { x: 100, y: 50, shape: "triangle-up", size: 8, color: "#26a69a" };
 *     void args;
 */
export type MarkerArgs = {
    readonly x: number;
    readonly y: number;
    readonly shape: MarkerShape;
    readonly size: number;
    readonly color: string | null;
};

/**
 * Inputs for {@link drawCharacter}. World-space `x` / `y` are pixels the
 * caller derives via `timeToX` / `priceToY`; `size` is the font px size.
 *
 * @since 1.7
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
    readonly location?: GlyphLocation;
    readonly color: string | null;
};

/**
 * Inputs for {@link drawArrow}. World-space `x` / `y` are pixels the caller
 * derives via `timeToX` / `priceToY`; `size` is the triangle bounding-box edge
 * length in pixels.
 *
 * @since 1.7
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
 * Position the label sits in relative to the (`x`, `y`) anchor.
 *
 * - `above` → text sits above the anchor (`textBaseline = "bottom"`).
 * - `below` → text sits below the anchor (`textBaseline = "top"`).
 * - `anchor` → text is vertically centred on the anchor (`textBaseline =
 *   "middle"`).
 *
 * @since 1.7
 * @stable
 * @example
 *     const p: LabelPosition = "above";
 *     void p;
 */
export type LabelPosition = "above" | "below" | "anchor";

/**
 * Inputs for {@link drawLabel}. World-space `x` / `y` are pixels the caller
 * derives via `timeToX` / `priceToY`. `font` defaults to `"10px sans-serif"`
 * when omitted.
 *
 * @since 1.7
 * @stable
 * @example
 *     const args: LabelArgs = { x: 100, y: 50, text: "PEAK", position: "above", color: "#26a69a" };
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

function anchoredShapeY(args: ShapeArgs): number {
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
 * Render a `shape` glyph at a plot anchor. The five filled-marker shapes
 * (`circle` / `triangle-up` / `triangle-down` / `square` / `diamond`)
 * delegate to {@link drawMarker}; `cross` / `xcross` / `flag` stroke their
 * geometry directly. A null `color` falls back to `fallbackColor`.
 *
 * @since 1.7
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     drawShape(ctx, { x: 10, y: 20, shape: "cross", size: 8, color: null }, "#90caf9");
 */
export function drawShape(ctx: RenderCtx, args: ShapeArgs, fallbackColor: string): void {
    const y = anchoredShapeY(args);
    if (
        args.shape === "circle" ||
        args.shape === "triangle-up" ||
        args.shape === "triangle-down" ||
        args.shape === "square" ||
        args.shape === "diamond"
    ) {
        drawMarker(ctx, { ...args, y, shape: args.shape }, fallbackColor);
        return;
    }

    ctx.strokeStyle = args.color ?? fallbackColor;
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

/**
 * Render a discrete marker glyph at (`x`, `y`). The renderer sets `fillStyle`
 * once, then dispatches on `shape`:
 *
 * - `circle` → `arc` → `closePath` → `fill`.
 * - `square` → single `fillRect` (`size x size`, centred on the anchor).
 * - `triangle-up` / `triangle-down` / `diamond` → polygon via `beginPath` +
 *   `moveTo` + `lineTo`s + `closePath` + `fill`.
 *
 * A null `color` falls back to `fallbackColor`.
 *
 * @since 1.7
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     drawMarker(ctx, { x: 100, y: 50, shape: "circle", size: 6, color: "#26a69a" }, "#90caf9");
 */
export function drawMarker(ctx: RenderCtx, args: MarkerArgs, fallbackColor: string): void {
    ctx.fillStyle = args.color ?? fallbackColor;
    const half = args.size / 2;
    switch (args.shape) {
        case "circle":
            ctx.beginPath();
            ctx.arc(args.x, args.y, half, 0, TWO_PI);
            ctx.closePath();
            ctx.fill();
            return;
        case "square":
            ctx.fillRect(args.x - half, args.y - half, args.size, args.size);
            return;
        case "triangle-up":
            ctx.beginPath();
            ctx.moveTo(args.x, args.y - half);
            ctx.lineTo(args.x + half, args.y + half);
            ctx.lineTo(args.x - half, args.y + half);
            ctx.closePath();
            ctx.fill();
            return;
        case "triangle-down":
            ctx.beginPath();
            ctx.moveTo(args.x, args.y + half);
            ctx.lineTo(args.x + half, args.y - half);
            ctx.lineTo(args.x - half, args.y - half);
            ctx.closePath();
            ctx.fill();
            return;
        case "diamond":
            ctx.beginPath();
            ctx.moveTo(args.x, args.y - half);
            ctx.lineTo(args.x + half, args.y);
            ctx.lineTo(args.x, args.y + half);
            ctx.lineTo(args.x - half, args.y);
            ctx.closePath();
            ctx.fill();
            return;
    }
}

function characterAnchor(args: CharacterArgs): {
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
 * Render a `character` glyph (Pine `plotchar`) as centred canvas text. A null
 * `color` falls back to `fallbackColor`.
 *
 * @since 1.7
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     drawCharacter(ctx, { x: 10, y: 20, char: "A", size: 12, color: null }, "#90caf9");
 */
export function drawCharacter(ctx: RenderCtx, args: CharacterArgs, fallbackColor: string): void {
    const resolved = characterAnchor(args);
    ctx.fillStyle = args.color ?? fallbackColor;
    ctx.font = `${args.size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = resolved.baseline;
    ctx.fillText(args.char, args.x, resolved.y);
}

/**
 * Render an `arrow` glyph (Pine `plotarrow`) as a filled directional triangle.
 * A null `color` falls back to `fallbackColor`.
 *
 * @since 1.7
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     drawArrow(ctx, { x: 10, y: 20, direction: "up", size: 10, color: null }, "#90caf9");
 */
export function drawArrow(ctx: RenderCtx, args: ArrowArgs, fallbackColor: string): void {
    const half = args.size / 2;
    ctx.fillStyle = args.color ?? fallbackColor;
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

function labelBaseline(position: LabelPosition): "top" | "middle" | "bottom" {
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
 * Render a single text annotation at (`x`, `y`). The renderer sets `fillStyle`,
 * `font`, `textAlign = "center"`, and a `position`-dependent `textBaseline`,
 * then calls `fillText`. A null `color` falls back to `fallbackColor`; an
 * omitted `font` falls back to `"10px sans-serif"`.
 *
 * @since 1.7
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     drawLabel(ctx, { x: 100, y: 50, text: "PEAK", position: "above", color: "#26a69a" }, "#90caf9");
 */
export function drawLabel(ctx: RenderCtx, args: LabelArgs, fallbackColor: string): void {
    ctx.fillStyle = args.color ?? fallbackColor;
    ctx.font = args.font ?? DEFAULT_LABEL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = labelBaseline(args.position);
    ctx.fillText(args.text, args.x, args.y);
}
