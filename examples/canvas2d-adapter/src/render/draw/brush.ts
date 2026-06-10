// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Stroke + fill semantics ported from
//   invinite/src/components/trading-chart/tools/brush-tool.ts,
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (BrushDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { BrushState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { worldPointToCanvas } from "./worldToCanvas";

const DEFAULT_LINE_WIDTH = 1;

/**
 * Render a `brush` drawing emission — a freehand polyline rendered as
 * a closed filled region. The renderer projects N anchors, builds a
 * `moveTo + N-1 lineTo + closePath` path, fills with `style.fill`,
 * then strokes with `style.stroke`. Both colours are required by
 * `BrushStyle`.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderBrush(ctx, e, view);
 *     void renderBrush;
 */
export function renderBrush(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as BrushState;
    const pts = state.anchors.map((p) => worldPointToCanvas(p, view));
    ctx.fillStyle = state.style.fill;
    ctx.strokeStyle = state.style.stroke;
    ctx.lineWidth = DEFAULT_LINE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}
