// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Stroke + quadratic Bezier semantics ported from
//   invinite/src/components/trading-chart/tools/curve-tool.ts,
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (CurveDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { CurveState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";
import { dashPattern } from "../lineDash.js";
import { sampleQuadratic } from "./bezier.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

const DEFAULT_COLOR = "#000000";
const DEFAULT_LINE_WIDTH = 1;
const CURVE_SAMPLES = 32;

/**
 * Render a `curve` drawing emission. The 3 world anchors are
 * `[from, control, to]` — the middle anchor IS the off-curve Bezier
 * control point (distinct from `arc` whose middle anchor lies ON the
 * curve at `t = 0.5`). Sampled at `CURVE_SAMPLES = 32` segments and
 * stroked as a polyline so the renderer stays pure on the existing
 * `RenderCtx` structural surface (no `quadraticCurveTo`).
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderCurve(ctx, e, view);
 *     void renderCurve;
 */
export function renderCurve(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as CurveState;
    const from = worldPointToCanvas(state.anchors[0], view);
    const control = worldPointToCanvas(state.anchors[1], view);
    const to = worldPointToCanvas(state.anchors[2], view);
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
