// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Stroke + fill semantics ported from the per-tool style application
// in invinite/src/components/trading-chart/tools/rectangle-tool.ts,
// triangle-tool.ts, rotated-rectangle-tool.ts (commit
// 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite). Re-licensed
// MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { ShapeStyle } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import { dashPattern } from "../lineDash.js";

const DEFAULT_STROKE = "#000000";
const DEFAULT_LINE_WIDTH = 1;
const DEFAULT_FILL_ALPHA = 1;

/**
 * Resolved {@link ShapeStyle} application result. `hasFill` lets the
 * renderer decide whether to emit a `ctx.fill()` call; `fillColor` +
 * `fillAlpha` carry the resolved values the renderer applies inside
 * its alpha-bracketed fill block.
 *
 * @since 0.3
 * @stable
 * @example
 *     const applied: AppliedShapeStyle = { hasFill: false, fillColor: "#000", fillAlpha: 1 };
 *     void applied;
 */
export type AppliedShapeStyle = {
    readonly hasFill: boolean;
    readonly fillColor: string;
    readonly fillAlpha: number;
};

/**
 * Apply a {@link ShapeStyle} to a {@link RenderCtx} — sets stroke
 * colour, line width, and dash pattern; returns the resolved fill
 * payload for the caller to apply inside an alpha-bracketed fill
 * block. Mirrors the Phase-3 drawing convention pinned by Task 5's
 * line renderers: defaults are `"#000000"` / `1` / solid; missing
 * `fill` produces `hasFill: false` and the renderer skips its
 * `ctx.fill()` call.
 *
 * The helper does NOT call `ctx.beginPath` / `ctx.fill` / `ctx.stroke`
 * — leaves the path + stroke / fill braid to the renderer so each kind
 * can order its calls (e.g. fill-then-stroke for solid shapes,
 * stroke-only for the polyline that has no fill field).
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     const applied = applyShapeStyle(ctx, { stroke: "#3b82f6", fill: "#dbeafe", fillAlpha: 0.4 });
 *     if (applied.hasFill) {
 *         ctx.fillStyle = applied.fillColor;
 *         ctx.globalAlpha = applied.fillAlpha;
 *         ctx.fill();
 *         ctx.globalAlpha = 1;
 *     }
 *     ctx.stroke();
 *     void applied;
 */
export function applyShapeStyle(ctx: RenderCtx, style: ShapeStyle): AppliedShapeStyle {
    ctx.strokeStyle = style.stroke ?? DEFAULT_STROKE;
    ctx.lineWidth = style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash(dashPattern(style.lineStyle ?? "solid"));
    if (style.fill === undefined) {
        return { hasFill: false, fillColor: DEFAULT_STROKE, fillAlpha: DEFAULT_FILL_ALPHA };
    }
    return {
        hasFill: true,
        fillColor: style.fill,
        fillAlpha: style.fillAlpha ?? DEFAULT_FILL_ALPHA,
    };
}
