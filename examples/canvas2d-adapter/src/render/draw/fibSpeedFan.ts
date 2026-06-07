// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Fan + fib-ratio slope semantics ported from
//   invinite/src/components/trading-chart/tools/fib-speed-fan-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FibSpeedFanState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { FIB_LEVELS, formatLevel } from "./fibLevels";
import { worldPointToCanvas } from "./worldToCanvas";

const DEFAULT_COLOR = "#facc15";
const DEFAULT_LINE_WIDTH = 1;
const LABEL_FONT = "12px sans-serif";
const LABEL_OFFSET_FRACTION = 0.25;

/**
 * Render a `fib-speed-fan` drawing emission as a fan of rays emanating
 * from `anchors[0]`. Each ray's direction scales the (anchors[0] →
 * anchors[1]) y-delta by a fib ratio; the x-delta stays constant. Ray
 * length is `max(pxWidth, pxHeight) * 2` so strokes always exit the
 * viewport (mirrors `fibWedge`'s convention). Optional
 * `style.showLabels` paints `formatLevel(level)` partway along each
 * ray.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderFibSpeedFan(ctx, e, view);
 *     void renderFibSpeedFan;
 */
export function renderFibSpeedFan(
    ctx: RenderCtx,
    e: DrawingEmission,
    view: Viewport,
): void {
    const state = e.state as FibSpeedFanState;
    const from = worldPointToCanvas(state.anchors[0], view);
    const to = worldPointToCanvas(state.anchors[1], view);
    const color = state.style.color ?? DEFAULT_COLOR;
    const levels = state.style.levels ?? FIB_LEVELS;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
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
        const rdx = dx;
        const rdy = level * dy;
        const mag = Math.hypot(rdx, rdy);
        if (mag === 0) continue;
        const ux = rdx / mag;
        const uy = rdy / mag;
        const endX = from.x + ux * rayLength;
        const endY = from.y + uy * rayLength;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        if (state.style.showLabels === true) {
            const labelX = from.x + ux * rayLength * LABEL_OFFSET_FRACTION;
            const labelY = from.y + uy * rayLength * LABEL_OFFSET_FRACTION;
            ctx.fillText(formatLevel(level), labelX, labelY);
        }
    }
}
