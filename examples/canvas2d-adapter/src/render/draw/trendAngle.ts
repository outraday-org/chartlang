// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Line + arc + angle-text semantics ported from
//   invinite/src/components/trading-chart/tools/trend-angle-tool.ts,
//   invinite/src/components/trading-chart/tools/lib/trend-angle-overlay.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { TrendAngleState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { dashPattern } from "../lineDash";
import { worldPointToCanvas } from "./worldToCanvas";

const DEFAULT_COLOR = "#000000";
const DEFAULT_LINE_WIDTH = 1;
const ANGLE_ARC_RADIUS_PX = 24;
const ANGLE_TEXT_FONT = "12px sans-serif";
const ANGLE_TEXT_OFFSET_PX = 6;

/**
 * Render a `trend-angle` drawing emission. Strokes the line from
 * `anchors[0]` → `anchors[1]`, draws a small arc centred on `anchors[0]`
 * spanning the angle between the segment direction and the canvas
 * positive-x axis, and writes the screen-space angle in degrees next
 * to the arc.
 *
 * The angle is reported in **screen-pixel space** (the renderer has
 * the projected pixel deltas; this matches what the user sees and
 * mirrors the invinite tool's `paintTrendAngleArc` convention). The
 * canvas y-axis grows downward, so `-dy` flips the sign back so a
 * positive angle reads "upward to the right" — same convention as
 * the invinite overlay.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderTrendAngle(ctx, e, view);
 *     void renderTrendAngle;
 */
export function renderTrendAngle(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as TrendAngleState;
    const a = worldPointToCanvas(state.anchors[0], view);
    const b = worldPointToCanvas(state.anchors[1], view);
    const color = state.style.color ?? DEFAULT_COLOR;

    ctx.strokeStyle = color;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash(dashPattern(state.style.lineStyle ?? "solid"));
    // Main segment.
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    // Angle arc — solid stroke regardless of `lineStyle` so the arc
    // reads cleanly.
    ctx.setLineDash([]);
    const angleRad = Math.atan2(-(b.y - a.y), b.x - a.x);
    // canvas arc() takes angles measured clockwise from the +x axis;
    // pass the negated screen angle so the arc sweeps from the +x
    // axis to the segment direction in the screen-up orientation.
    ctx.beginPath();
    ctx.arc(a.x, a.y, ANGLE_ARC_RADIUS_PX, -angleRad, 0);
    ctx.stroke();
    // Angle text.
    const degrees = (angleRad * 180) / Math.PI;
    ctx.fillStyle = color;
    ctx.font = ANGLE_TEXT_FONT;
    ctx.fillText(`${degrees.toFixed(1)}°`, a.x + ANGLE_ARC_RADIUS_PX + ANGLE_TEXT_OFFSET_PX, a.y);
}
