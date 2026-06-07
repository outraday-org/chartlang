// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Wedge ray + angular-interpolation semantics ported from
//   invinite/src/components/trading-chart/tools/fib-wedge-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FibWedgeState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { FIB_LEVELS, formatLevel } from "./fibLevels";
import { worldPointToCanvas } from "./worldToCanvas";

const DEFAULT_COLOR = "#facc15";
const DEFAULT_LINE_WIDTH = 1;
const LABEL_FONT = "12px sans-serif";
const LABEL_OFFSET_FRACTION = 0.25;

/**
 * Render a `fib-wedge` drawing emission as a fan of rays emanating
 * from `anchors[0]` (the pivot) at fib-ratio-interpolated angles
 * between the (pivot→`anchors[1]`) and (pivot→`anchors[2]`) direction
 * vectors. Ray length is `max(pxWidth, pxHeight) * 2` so the strokes
 * always exit the viewport. Optional `style.showLabels` paints
 * `formatLevel(level)` partway along each ray.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderFibWedge(ctx, e, view);
 *     void renderFibWedge;
 */
export function renderFibWedge(
    ctx: RenderCtx,
    e: DrawingEmission,
    view: Viewport,
): void {
    const state = e.state as FibWedgeState;
    const pivot = worldPointToCanvas(state.anchors[0], view);
    const r1 = worldPointToCanvas(state.anchors[1], view);
    const r2 = worldPointToCanvas(state.anchors[2], view);
    const color = state.style.color ?? DEFAULT_COLOR;
    const levels = state.style.levels ?? FIB_LEVELS;
    const d1x = r1.x - pivot.x;
    const d1y = r1.y - pivot.y;
    const d2x = r2.x - pivot.x;
    const d2y = r2.y - pivot.y;
    const rayLength = Math.max(view.pxWidth, view.pxHeight) * 2;
    ctx.strokeStyle = color;
    ctx.lineWidth = DEFAULT_LINE_WIDTH;
    ctx.setLineDash([]);
    if (state.style.showLabels === true) {
        ctx.font = LABEL_FONT;
        ctx.fillStyle = color;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
    }
    for (const level of levels) {
        const dx = d1x + level * (d2x - d1x);
        const dy = d1y + level * (d2y - d1y);
        const mag = Math.hypot(dx, dy);
        if (mag === 0) continue;
        const ux = dx / mag;
        const uy = dy / mag;
        const endX = pivot.x + ux * rayLength;
        const endY = pivot.y + uy * rayLength;
        ctx.beginPath();
        ctx.moveTo(pivot.x, pivot.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        if (state.style.showLabels === true) {
            const labelX = pivot.x + ux * rayLength * LABEL_OFFSET_FRACTION;
            const labelY = pivot.y + uy * rayLength * LABEL_OFFSET_FRACTION;
            ctx.fillText(formatLevel(level), labelX, labelY);
        }
    }
}
