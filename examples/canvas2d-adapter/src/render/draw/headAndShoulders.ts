// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Pivot polyline + neckline render derived from
//   invinite/src/components/trading-chart/tools/head-and-shoulders-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Note: Phase-3 renders the 5-anchor landed shape (no start/end);
// the neckline strokes only between the two trough anchors
// (anchors[1] = leftLow, anchors[3] = rightLow).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { HeadAndShouldersState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { renderNamedPolyline } from "./namedPolyline";
import { worldPointToCanvas } from "./worldToCanvas";

const LABELS: ReadonlyArray<string> = ["LS", "LL", "H", "RL", "RS"];
const DEFAULT_COLOR = "#f59e0b";

/**
 * Render a `head-and-shoulders` drawing emission as a 4-leg open
 * polyline through the 5 anchors (LS-LL-H-RL-RS) plus a neckline
 * stroke between the two trough anchors (LL → RL). Each pivot is
 * labelled.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderHeadAndShoulders(ctx, e, view);
 *     void renderHeadAndShoulders;
 */
export function renderHeadAndShoulders(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as HeadAndShouldersState;
    const points = state.anchors.map((p) => worldPointToCanvas(p, view));
    renderNamedPolyline(ctx, points, LABELS, state.style);
    // Neckline between the two trough anchors. `renderNamedPolyline`
    // already set strokeStyle / lineWidth / setLineDash, so we just
    // beginPath + moveTo + lineTo + stroke.
    ctx.strokeStyle = state.style.color ?? DEFAULT_COLOR;
    ctx.beginPath();
    ctx.moveTo(points[1].x, points[1].y);
    ctx.lineTo(points[3].x, points[3].y);
    ctx.stroke();
}
