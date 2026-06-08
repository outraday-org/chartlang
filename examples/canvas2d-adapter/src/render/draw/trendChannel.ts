// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Geometry + stroke semantics ported from
//   invinite/src/components/trading-chart/tools/trend-channel-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { TrendChannelState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { dashPattern } from "../lineDash";
import { worldPointToCanvas } from "./worldToCanvas";

const DEFAULT_COLOR = "#000000";
const DEFAULT_LINE_WIDTH = 1;

/**
 * Render a `trend-channel` drawing emission as two parallel line
 * segments. The first stroke is the primary line through `anchors[0]`
 * → `anchors[1]`; the second is its translate carrying `anchors[2]`
 * (the parallel-hook anchor). Stroke-only — the fill between rails is
 * deferred per `tasks/phase-3-drawing-parity/10-channels.plan.md` §5
 * (no `fillAlpha` on `LineDrawStyle`).
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderTrendChannel(ctx, e, view);
 *     void renderTrendChannel;
 */
export function renderTrendChannel(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as TrendChannelState;
    const a = worldPointToCanvas(state.anchors[0], view);
    const b = worldPointToCanvas(state.anchors[1], view);
    const hook = worldPointToCanvas(state.anchors[2], view);
    // Translate the primary line by the offset vector from a → hook to
    // get the parallel rail's endpoints. This keeps the second line
    // strictly parallel to the first (same direction vector).
    const dx = hook.x - a.x;
    const dy = hook.y - a.y;
    ctx.strokeStyle = state.style.color ?? DEFAULT_COLOR;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash(dashPattern(state.style.lineStyle ?? "solid"));
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(a.x + dx, a.y + dy);
    ctx.lineTo(b.x + dx, b.y + dy);
    ctx.stroke();
    ctx.setLineDash([]);
}
