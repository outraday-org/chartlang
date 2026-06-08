// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Geometry + stroke semantics ported from
//   invinite/src/components/trading-chart/tools/disjoint-channel-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { DisjointChannelState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { dashPattern } from "../lineDash";
import { worldPointToCanvas } from "./worldToCanvas";

const DEFAULT_COLOR = "#000000";
const DEFAULT_LINE_WIDTH = 1;

/**
 * Render a `disjoint-channel` drawing emission as two independent line
 * segments. Anchors `[A, B, C, D]` — segment 1 from A → B, segment 2
 * from C → D, no shared geometry constraint. Stroke-only.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderDisjointChannel(ctx, e, view);
 *     void renderDisjointChannel;
 */
export function renderDisjointChannel(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as DisjointChannelState;
    const a = worldPointToCanvas(state.anchors[0], view);
    const b = worldPointToCanvas(state.anchors[1], view);
    const c = worldPointToCanvas(state.anchors[2], view);
    const d = worldPointToCanvas(state.anchors[3], view);
    ctx.strokeStyle = state.style.color ?? DEFAULT_COLOR;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash(dashPattern(state.style.lineStyle ?? "solid"));
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
    ctx.setLineDash([]);
}
