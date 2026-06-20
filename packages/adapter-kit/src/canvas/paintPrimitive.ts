// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawPrimitive, FillStyle, StrokeStyle } from "../geometry/types.js";
import type { RenderCtx } from "./renderCtx.js";

/**
 * The canvas `textAlign` value a {@link DrawPrimitive} `text.align`
 * maps to. The IR uses the narrower `left | center | right`.
 */
const ALIGN_TO_CANVAS: Readonly<Record<"left" | "center" | "right", "left" | "center" | "right">> =
    { left: "left", center: "center", right: "right" };

/**
 * The canvas `textBaseline` value a {@link DrawPrimitive} `text.baseline`
 * maps to. The IR uses the narrower `top | middle | bottom`.
 */
const BASELINE_TO_CANVAS: Readonly<
    Record<"top" | "middle" | "bottom", "top" | "middle" | "bottom">
> = { top: "top", middle: "middle", bottom: "bottom" };

function applyFill(ctx: RenderCtx, fill: FillStyle): void {
    ctx.fillStyle = fill.color;
    ctx.globalAlpha = fill.alpha;
    ctx.fill();
    ctx.globalAlpha = 1;
}

function applyStrokeStyle(ctx: RenderCtx, stroke: StrokeStyle): void {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.setLineDash(stroke.dash);
}

/**
 * Stroke the current path, bracketing the `stroke()` call in
 * `globalAlpha` when `stroke.alpha` is set (the `highlighter`
 * translucency), then resetting the dash. When `alpha` is omitted the
 * call sequence is exactly `stroke()` → `setLineDash([])` — byte-identical
 * to the Task-1 painter — so no-alpha strokes never re-hash.
 */
function strokeWithAlpha(ctx: RenderCtx, stroke: StrokeStyle): void {
    if (stroke.alpha !== undefined) {
        ctx.globalAlpha = stroke.alpha;
        ctx.stroke();
        ctx.globalAlpha = 1;
    } else {
        ctx.stroke();
    }
    ctx.setLineDash([]);
}

/**
 * Paint one {@link DrawPrimitive} into a {@link RenderCtx}. The canvas
 * sink shared by the canvas2d, lightweight-charts, and uplot adapters.
 * For each primitive the painter applies the stroke style (when set),
 * builds the path, fills before stroking (so the outline draws on top
 * of the band), and resets `setLineDash([])` + `globalAlpha = 1` after
 * use so downstream draws are unaffected — matching the per-kind
 * renderer conventions the IR replaces. A `stroke.alpha` (the
 * `highlighter` translucency) brackets the `stroke()` in `globalAlpha`;
 * an omitted `alpha` emits no `globalAlpha` mutation, keeping the
 * sequence byte-identical to a Task-1 stroke.
 *
 * `text.bgColor` is carried on the IR but NOT painted here (the
 * structural `RenderCtx` exposes neither `measureText` nor a
 * background-rect path), mirroring the source renderers. The IR
 * `marker` primitive is painted as a sized glyph; no basic kind emits
 * it today, but adapters / future kinds rely on the painter covering
 * every IR shape.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     paintPrimitive(ctx, {
 *         kind: "polyline",
 *         points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
 *         closed: false,
 *         stroke: { color: "#000000", width: 1, dash: [] },
 *     });
 *     void paintPrimitive;
 */
export function paintPrimitive(ctx: RenderCtx, p: DrawPrimitive): void {
    switch (p.kind) {
        case "polyline": {
            if (p.points.length === 0) return;
            if (p.stroke !== undefined) applyStrokeStyle(ctx, p.stroke);
            ctx.beginPath();
            ctx.moveTo(p.points[0].x, p.points[0].y);
            for (let i = 1; i < p.points.length; i++) {
                ctx.lineTo(p.points[i].x, p.points[i].y);
            }
            if (p.closed) ctx.closePath();
            if (p.fill !== undefined) applyFill(ctx, p.fill);
            if (p.stroke !== undefined) strokeWithAlpha(ctx, p.stroke);
            return;
        }
        case "arc": {
            if (p.stroke !== undefined) applyStrokeStyle(ctx, p.stroke);
            ctx.beginPath();
            ctx.arc(p.cx, p.cy, p.r, p.start, p.end);
            ctx.closePath();
            if (p.fill !== undefined) applyFill(ctx, p.fill);
            if (p.stroke !== undefined) strokeWithAlpha(ctx, p.stroke);
            return;
        }
        case "text": {
            ctx.font = p.font;
            ctx.textAlign = ALIGN_TO_CANVAS[p.align];
            ctx.textBaseline = BASELINE_TO_CANVAS[p.baseline];
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, p.x, p.y);
            return;
        }
        case "marker": {
            const polygon = markerPolygon(p.shape, p.x, p.y, p.size);
            if (p.stroke !== undefined) applyStrokeStyle(ctx, p.stroke);
            ctx.beginPath();
            ctx.moveTo(polygon[0].x, polygon[0].y);
            for (let i = 1; i < polygon.length; i++) {
                ctx.lineTo(polygon[i].x, polygon[i].y);
            }
            ctx.closePath();
            if (p.fill !== undefined) applyFill(ctx, p.fill);
            if (p.stroke !== undefined) strokeWithAlpha(ctx, p.stroke);
            return;
        }
    }
}

/**
 * Vertices of a sized marker glyph centred on `(x, y)`. `circle` is
 * approximated as a square for the closed-polygon painter — the IR
 * `marker` is emitted by no basic kind today, so the approximation only
 * matters once an adapter / later task uses it; the contract is a
 * non-empty closed polygon for every shape.
 */
function markerPolygon(
    shape: "circle" | "square" | "diamond" | "triangle-up" | "triangle-down",
    x: number,
    y: number,
    size: number,
): ReadonlyArray<{ readonly x: number; readonly y: number }> {
    const h = size / 2;
    switch (shape) {
        case "circle":
        case "square":
            return [
                { x: x - h, y: y - h },
                { x: x + h, y: y - h },
                { x: x + h, y: y + h },
                { x: x - h, y: y + h },
            ];
        case "diamond":
            return [
                { x, y: y - h },
                { x: x + h, y },
                { x, y: y + h },
                { x: x - h, y },
            ];
        case "triangle-up":
            return [
                { x, y: y - h },
                { x: x + h, y: y + h },
                { x: x - h, y: y + h },
            ];
        case "triangle-down":
            return [
                { x, y: y + h },
                { x: x + h, y: y - h },
                { x: x - h, y: y - h },
            ];
    }
}
