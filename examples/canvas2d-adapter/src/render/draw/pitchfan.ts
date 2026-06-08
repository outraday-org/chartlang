// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Three-ray fan semantics ported from
//   invinite/src/components/trading-chart/tools/pitchfan-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { PitchfanState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { worldPointToCanvas } from "./worldToCanvas";

const DEFAULT_COLOR = "#ec4899";
const DEFAULT_LINE_WIDTH = 1;

/**
 * Render a `pitchfan` drawing emission as three rays emanating from
 * `anchors[0]` and passing through `anchors[1]`,
 * `mid(anchors[1], anchors[2])`, and `anchors[2]` respectively. Each
 * ray is extended to a fixed length `max(pxWidth, pxHeight) * 2` so
 * it always exits the viewport.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderPitchfan(ctx, e, view);
 *     void renderPitchfan;
 */
export function renderPitchfan(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as PitchfanState;
    const a = worldPointToCanvas(state.anchors[0], view);
    const b = worldPointToCanvas(state.anchors[1], view);
    const c = worldPointToCanvas(state.anchors[2], view);
    const midBC = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    ctx.strokeStyle = state.style.color ?? DEFAULT_COLOR;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash([]);
    const rayLength = Math.max(view.pxWidth, view.pxHeight) * 2;
    for (const target of [b, midBC, c]) {
        const dx = target.x - a.x;
        const dy = target.y - a.y;
        const mag = Math.hypot(dx, dy);
        if (mag === 0) continue;
        const ux = dx / mag;
        const uy = dy / mag;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + ux * rayLength, a.y + uy * rayLength);
        ctx.stroke();
    }
}
