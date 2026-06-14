// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Stroke + auto-close semantics ported from
//   invinite/src/components/trading-chart/tools/polyline-tool.ts,
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (PolylineDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { PolylineState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";
import { dashPattern } from "../lineDash.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

const DEFAULT_COLOR = "#000000";
const DEFAULT_LINE_WIDTH = 1;

/**
 * Render a `polyline` drawing emission as a closed N-vertex polyline.
 * The renderer projects each world anchor, walks `moveTo + (N-1)
 * lineTo`, then `closePath()` to connect back to the first anchor.
 * Polyline carries `LineDrawStyle` (no fill) — only the stroke path
 * is emitted.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderPolyline(ctx, e, view);
 *     void renderPolyline;
 */
export function renderPolyline(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as PolylineState;
    const pts = state.anchors.map((p) => worldPointToCanvas(p, view));
    ctx.strokeStyle = state.style.color ?? DEFAULT_COLOR;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash(dashPattern(state.style.lineStyle ?? "solid"));
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
}
