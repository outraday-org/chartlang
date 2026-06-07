// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Fan angle + slope semantics ported from
//   invinite/src/components/trading-chart/tools/gann-fan-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { GannFanState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { GANN_FAN_RATIOS } from "./gannLevels";
import { worldPointToCanvas } from "./worldToCanvas";

const DEFAULT_COLOR = "#a855f7";
const DEFAULT_LINE_WIDTH = 1;

/**
 * Render a `gann-fan` drawing emission as 9 rays emanating from
 * `anchors[0]`. Each ray's direction is `(dx, ratio * dy)` where
 * `(dx, dy)` is the (a→b) vector in canvas space and `ratio` cycles
 * through {@link GANN_FAN_RATIOS}. Rays extend to a fixed length
 * `max(pxWidth, pxHeight) * 2` so they always exit the viewport.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderGannFan(ctx, e, view);
 *     void renderGannFan;
 */
export function renderGannFan(
    ctx: RenderCtx,
    e: DrawingEmission,
    view: Viewport,
): void {
    const state = e.state as GannFanState;
    const pivot = worldPointToCanvas(state.anchors[0], view);
    const ref = worldPointToCanvas(state.anchors[1], view);
    const dx = ref.x - pivot.x;
    const dy = ref.y - pivot.y;
    const color = state.style.color ?? DEFAULT_COLOR;
    const rayLength = Math.max(view.pxWidth, view.pxHeight) * 2;
    ctx.strokeStyle = color;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash([]);
    for (const ratio of GANN_FAN_RATIOS) {
        const rx = dx;
        const ry = ratio * dy;
        const mag = Math.hypot(rx, ry);
        if (mag === 0) continue;
        const ux = rx / mag;
        const uy = ry / mag;
        ctx.beginPath();
        ctx.moveTo(pivot.x, pivot.y);
        ctx.lineTo(pivot.x + ux * rayLength, pivot.y + uy * rayLength);
        ctx.stroke();
    }
}
