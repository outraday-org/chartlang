// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Stroke semantics ported from
//   invinite/src/components/trading-chart/tools/pen-tool.ts,
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (PenDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { PenState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { dashPattern } from "../lineDash";
import { worldPointToCanvas } from "./worldToCanvas";

const DEFAULT_COLOR = "#000000";
const DEFAULT_LINE_WIDTH = 1;

/**
 * Render a `pen` drawing emission — a freehand stroke as an OPEN
 * polyline through N world anchors. Mirrors `path` (Task 7) but uses
 * `PenState` shape — no `style.closed` toggle. Pressure-driven stroke
 * width variance is out of scope for Phase 3 (Phase-4+ adapter
 * concern); this renderer treats every anchor uniformly.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderPen(ctx, e, view);
 *     void renderPen;
 */
export function renderPen(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as PenState;
    const pts = state.anchors.map((p) => worldPointToCanvas(p, view));
    ctx.strokeStyle = state.style.color ?? DEFAULT_COLOR;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash(dashPattern(state.style.lineStyle ?? "solid"));
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
}
