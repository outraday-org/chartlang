// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Stroke + fill semantics ported from
//   invinite/src/components/trading-chart/tools/rectangle-tool.ts,
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (RectangleDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { RectangleState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { applyShapeStyle } from "./shapeStyle";
import { worldPointToCanvas } from "./worldToCanvas";

/**
 * Render a `rectangle` drawing emission as a closed 4-corner polygon
 * in canvas pixel space. The renderer projects the two world anchors,
 * derives the axis-aligned bounding box, then walks the four corners
 * as a closed path so the same call sequence covers fill (when
 * `style.fill` is set) and stroke. `fillAlpha` is bracketed around the
 * `ctx.fill()` call so the subsequent stroke draws at full opacity.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderRectangle(ctx, e, view);
 *     void renderRectangle;
 */
export function renderRectangle(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as RectangleState;
    const a = worldPointToCanvas(state.anchors[0], view);
    const b = worldPointToCanvas(state.anchors[1], view);
    const xMin = Math.min(a.x, b.x);
    const xMax = Math.max(a.x, b.x);
    const yMin = Math.min(a.y, b.y);
    const yMax = Math.max(a.y, b.y);
    const applied = applyShapeStyle(ctx, state.style);
    ctx.beginPath();
    ctx.moveTo(xMin, yMin);
    ctx.lineTo(xMax, yMin);
    ctx.lineTo(xMax, yMax);
    ctx.lineTo(xMin, yMax);
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
