// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Median + parallel-handle geometry ported from
//   invinite/src/components/trading-chart/tools/pitchfork-tool.ts +
//   invinite/src/components/trading-chart/tools/lib/pitchfork-geometry.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Variant collapse covers standard / schiff / modifiedSchiff / inside.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { PitchforkState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { medianOriginFor, medianTargetFor } from "./pitchforkGeom";
import { worldPointToCanvas } from "./worldToCanvas";

const DEFAULT_COLOR = "#ec4899";
const DEFAULT_LINE_WIDTH = 1;

/**
 * Render a `pitchfork` drawing emission as three strokes: a median
 * line from the per-variant `medianOrigin` through `medianTarget`
 * (extended by one fork vector past the target), plus two parallel
 * handle rails through `anchors[1]` and `anchors[2]` offset by the
 * same extension vector. The variant discriminator selects one of
 * the four median-origin formulas from {@link medianOriginFor}.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderPitchfork(ctx, e, view);
 *     void renderPitchfork;
 */
export function renderPitchfork(
    ctx: RenderCtx,
    e: DrawingEmission,
    view: Viewport,
): void {
    const state = e.state as PitchforkState;
    const a = worldPointToCanvas(state.anchors[0], view);
    const b = worldPointToCanvas(state.anchors[1], view);
    const c = worldPointToCanvas(state.anchors[2], view);
    const origin = medianOriginFor(state.variant, a, b, c);
    const target = medianTargetFor(state.variant, a, b, c);
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    ctx.strokeStyle = state.style.color ?? DEFAULT_COLOR;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash([]);
    // Median rail extends one fork-vector past `target` so its full
    // length is `origin → target + dx,dy` — matches invinite's
    // `pitchfork-geometry.ts:213-229` median emission.
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(target.x + dx, target.y + dy);
    ctx.stroke();
    // Parallel handle through `b`.
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + dx, b.y + dy);
    ctx.stroke();
    // Parallel handle through `c`.
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + dx, c.y + dy);
    ctx.stroke();
}
