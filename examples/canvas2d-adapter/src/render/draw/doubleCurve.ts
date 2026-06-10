// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Stroke + cubic Bezier semantics ported from
//   invinite/src/components/trading-chart/tools/double-curve-tool.ts,
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (DoubleCurveDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { DoubleCurveState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";
import { dashPattern } from "../lineDash.js";
import { sampleCubic } from "./bezier.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

const DEFAULT_COLOR = "#000000";
const DEFAULT_LINE_WIDTH = 1;
const CURVE_SAMPLES = 32;

/**
 * Render a `double-curve` drawing emission. The 5 world anchors are
 * `[P0, P1, mid, P3, P4]`. The renderer paints a single cubic Bezier
 * from `P0` to `P4` with off-curve controls `P1` and `P3`; the middle
 * stitch anchor `mid` is preserved in state (so future split-render
 * tasks can stitch two cubics through it) but unused at paint time.
 * Sampled at `CURVE_SAMPLES = 32` segments and stroked as a polyline.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderDoubleCurve(ctx, e, view);
 *     void renderDoubleCurve;
 */
export function renderDoubleCurve(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as DoubleCurveState;
    const p0 = worldPointToCanvas(state.anchors[0], view);
    const p1 = worldPointToCanvas(state.anchors[1], view);
    // anchors[2] is the visual mid / stitch anchor — preserved in state
    // but not consumed by the current single-cubic render path.
    const p3 = worldPointToCanvas(state.anchors[3], view);
    const p4 = worldPointToCanvas(state.anchors[4], view);
    const samples = sampleCubic(p0, p1, p3, p4, CURVE_SAMPLES);
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
