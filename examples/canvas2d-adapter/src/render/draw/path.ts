// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Stroke + open / closed semantics ported from
//   invinite/src/components/trading-chart/tools/path-tool.ts,
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (PathDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { PathState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { dashPattern } from "../lineDash";
import { worldPointToCanvas } from "./worldToCanvas";

const DEFAULT_COLOR = "#000000";
const DEFAULT_LINE_WIDTH = 1;

/**
 * Render a `path` drawing emission as an OPEN N-vertex polyline.
 * Distinct from `polyline` (Task 6) which auto-closes — `path` does
 * NOT issue `closePath()` unless `style.closed === true`. Style is
 * `LineDrawStyle` (no fill); only the stroke path is emitted.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderPath(ctx, e, view);
 *     void renderPath;
 */
export function renderPath(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as PathState;
    const pts = state.anchors.map((p) => worldPointToCanvas(p, view));
    ctx.strokeStyle = state.style.color ?? DEFAULT_COLOR;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash(dashPattern(state.style.lineStyle ?? "solid"));
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
    }
    if (state.style.closed === true) {
        ctx.closePath();
    }
    ctx.stroke();
    ctx.setLineDash([]);
}
