// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Geometry + stroke semantics ported from
//   invinite/src/components/trading-chart/tools/flat-top-bottom-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FlatTopBottomState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";
import { dashPattern } from "../lineDash.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

const DEFAULT_COLOR = "#000000";
const DEFAULT_LINE_WIDTH = 1;

/**
 * Render a `flat-top-bottom` drawing emission as two horizontal rails.
 * Anchors `[leftEdge, rightEdge, oppositeHook]`: the top rail sits at
 * `max(leftEdge.price, oppositeHook.price)` and the bottom rail at
 * `min(...)` — the time range comes from `leftEdge.time` and
 * `rightEdge.time`. Mirrors invinite's flat-top-bottom geometry with
 * the landed 3-anchor core shape (see
 * `tasks/phase-3-drawing-parity/10-channels.plan.md` §1).
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderFlatTopBottom(ctx, e, view);
 *     void renderFlatTopBottom;
 */
export function renderFlatTopBottom(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as FlatTopBottomState;
    const p0 = state.anchors[0];
    const p1 = state.anchors[1];
    const p2 = state.anchors[2];
    const topPrice = Math.max(p0.price, p2.price);
    const bottomPrice = Math.min(p0.price, p2.price);
    const topLeft = worldPointToCanvas({ time: p0.time, price: topPrice }, view);
    const topRight = worldPointToCanvas({ time: p1.time, price: topPrice }, view);
    const bottomLeft = worldPointToCanvas({ time: p0.time, price: bottomPrice }, view);
    const bottomRight = worldPointToCanvas({ time: p1.time, price: bottomPrice }, view);
    ctx.strokeStyle = state.style.color ?? DEFAULT_COLOR;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash(dashPattern(state.style.lineStyle ?? "solid"));
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bottomLeft.x, bottomLeft.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.stroke();
    ctx.setLineDash([]);
}
