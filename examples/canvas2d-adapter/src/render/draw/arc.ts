// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Stroke + apex-driven control derivation ported from
//   invinite/src/components/trading-chart/tools/arc-tool.ts,
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (ArcDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { ArcState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { dashPattern } from "../lineDash";
import { sampleQuadratic } from "./bezier";
import { worldPointToCanvas } from "./worldToCanvas";

const DEFAULT_COLOR = "#000000";
const DEFAULT_LINE_WIDTH = 1;
const CURVE_SAMPLES = 32;

/**
 * Render an `arc` drawing emission. The 3 world anchors are
 * `[from, apex, to]` — the renderer derives a quadratic Bezier
 * control point via inverse-quadratic interpolation so the curve
 * passes through `apex` at parameter `t = 0.5`. The structural
 * `RenderCtx` exposes neither `quadraticCurveTo` nor a Bezier helper,
 * so the curve is sampled (`CURVE_SAMPLES = 32` segments) and
 * stroked as a polyline. Mirrors the Phase-3 pure-on-RenderCtx
 * convention Task 7's `ellipse` introduced.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderArc(ctx, e, view);
 *     void renderArc;
 */
export function renderArc(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as ArcState;
    const from = worldPointToCanvas(state.anchors[0], view);
    const apex = worldPointToCanvas(state.anchors[1], view);
    const to = worldPointToCanvas(state.anchors[2], view);
    // Inverse-quadratic interpolation: B(0.5) = 0.25*from + 0.5*control
    // + 0.25*to. To make B(0.5) === apex: control = 2*apex - 0.5*(from
    // + to). This places the apex exactly on the curve.
    const control = {
        x: 2 * apex.x - 0.5 * (from.x + to.x),
        y: 2 * apex.y - 0.5 * (from.y + to.y),
    };
    const samples = sampleQuadratic(from, control, to, CURVE_SAMPLES);
    ctx.strokeStyle = state.style.color ?? DEFAULT_COLOR;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash(dashPattern(state.style.lineStyle ?? "solid"));
    ctx.beginPath();
    ctx.moveTo(samples[0].x, samples[0].y);
    for (let i = 1; i < samples.length; i++) {
        ctx.lineTo(samples[i].x, samples[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
}
