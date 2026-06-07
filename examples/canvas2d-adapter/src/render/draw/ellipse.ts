// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Stroke + fill + bounding-box semantics ported from
//   invinite/src/components/trading-chart/tools/ellipse-tool.ts,
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (EllipseDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { EllipseState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { applyShapeStyle } from "./shapeStyle";
import { worldPointToCanvas } from "./worldToCanvas";

const TWO_PI = Math.PI * 2;

/**
 * Number of polyline segments used to approximate the ellipse. 64
 * segments give visually smooth strokes at typical viewport sizes
 * (≈800px wide) while keeping the call log bounded.
 */
const SEGMENTS = 64;

/**
 * Render an axis-aligned `ellipse` drawing emission. The two world
 * anchors define the bounding box; the renderer derives the centre +
 * (rx, ry) semi-axes and walks an N-segment polyline approximation
 * (Phase-1 `RenderCtx` exposes `arc(...)` but not `ellipse(...)` — a
 * polyline keeps the stroke entirely on the existing structural
 * surface without widening it). Rotated ellipses (invinite's
 * `widthOffset` form) are out of scope for Phase 3.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderEllipse(ctx, e, view);
 *     void renderEllipse;
 */
export function renderEllipse(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as EllipseState;
    const a = worldPointToCanvas(state.anchors[0], view);
    const b = worldPointToCanvas(state.anchors[1], view);
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const rx = Math.abs(b.x - a.x) / 2;
    const ry = Math.abs(b.y - a.y) / 2;
    const applied = applyShapeStyle(ctx, state.style);
    ctx.beginPath();
    ctx.moveTo(cx + rx, cy);
    for (let i = 1; i < SEGMENTS; i++) {
        const theta = (i / SEGMENTS) * TWO_PI;
        ctx.lineTo(cx + rx * Math.cos(theta), cy + ry * Math.sin(theta));
    }
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
