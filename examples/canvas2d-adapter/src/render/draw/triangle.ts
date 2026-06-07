// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Stroke + fill semantics ported from
//   invinite/src/components/trading-chart/tools/triangle-tool.ts,
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (TriangleDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { TriangleState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { applyShapeStyle } from "./shapeStyle";
import { worldPointToCanvas } from "./worldToCanvas";

/**
 * Render a `triangle` drawing emission as a closed 3-vertex polygon.
 * Distinct from `draw.trianglePattern` (Task 15) — that variant is a
 * 5-anchor harmonic pattern and routes to its own renderer.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderTriangle(ctx, e, view);
 *     void renderTriangle;
 */
export function renderTriangle(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as TriangleState;
    const v0 = worldPointToCanvas(state.anchors[0], view);
    const v1 = worldPointToCanvas(state.anchors[1], view);
    const v2 = worldPointToCanvas(state.anchors[2], view);
    const applied = applyShapeStyle(ctx, state.style);
    ctx.beginPath();
    ctx.moveTo(v0.x, v0.y);
    ctx.lineTo(v1.x, v1.y);
    ctx.lineTo(v2.x, v2.y);
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
