// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Stroke + fill + radius semantics ported from
//   invinite/src/components/trading-chart/tools/circle-tool.ts,
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (CircleDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { CircleState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { applyShapeStyle } from "./shapeStyle";
import { worldPointToCanvas } from "./worldToCanvas";

const TWO_PI = Math.PI * 2;

/**
 * Render a `circle` drawing emission. The radius is derived in
 * canvas-pixel space from the projected distance between the two
 * world anchors (`|edge - centre|`) so the stroke stays the same
 * apparent thickness across zoom changes (matches invinite's
 * `circle-tool.ts`). Issues one `ctx.arc(...)` call wrapped in the
 * standard fill / stroke braid from `applyShapeStyle`.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderCircle(ctx, e, view);
 *     void renderCircle;
 */
export function renderCircle(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as CircleState;
    const centre = worldPointToCanvas(state.anchors[0], view);
    const edge = worldPointToCanvas(state.anchors[1], view);
    const radius = Math.hypot(edge.x - centre.x, edge.y - centre.y);
    const applied = applyShapeStyle(ctx, state.style);
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, radius, 0, TWO_PI);
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
