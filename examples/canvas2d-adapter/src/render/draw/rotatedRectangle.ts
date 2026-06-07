// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Stroke + fill semantics ported from
//   invinite/src/components/trading-chart/tools/rotated-rectangle-tool.ts,
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (RotatedRectangleDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { RotatedRectangleState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { applyShapeStyle } from "./shapeStyle";
import { worldPointToCanvas } from "./worldToCanvas";

/**
 * Render a `rotated-rectangle` drawing emission as a closed 4-corner
 * polygon. The renderer projects the four anchors (supplied in stroke
 * order CW or CCW) and walks them as a closed path; canvas matrix ops
 * are unnecessary because the world anchors carry the rotation
 * directly.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderRotatedRectangle(ctx, e, view);
 *     void renderRotatedRectangle;
 */
export function renderRotatedRectangle(
    ctx: RenderCtx,
    e: DrawingEmission,
    view: Viewport,
): void {
    const state = e.state as RotatedRectangleState;
    const corners = state.anchors.map((p) => worldPointToCanvas(p, view));
    const applied = applyShapeStyle(ctx, state.style);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    ctx.lineTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.lineTo(corners[3].x, corners[3].y);
    ctx.closePath();
    if (applied.hasFill) {
        ctx.fillStyle = applied.fillColor;
        ctx.globalAlpha = applied.fillAlpha;
        ctx.fill();
        ctx.globalAlpha = 1;
    }
    ctx.stroke();
    ctx.setLineDash([]);
}
