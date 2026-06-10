// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Stroke + right-edge extension semantics ported from
//   invinite/src/components/trading-chart/tools/horizontal-ray-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { HorizontalRayState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";
import { dashPattern } from "../lineDash.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

const DEFAULT_COLOR = "#000000";
const DEFAULT_LINE_WIDTH = 1;

/**
 * Render a `horizontal-ray` drawing emission. Strokes from the
 * projected anchor across the right edge of the viewport at constant
 * y (the anchor's `priceToY` value).
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderHorizontalRay(ctx, e, view);
 *     void renderHorizontalRay;
 */
export function renderHorizontalRay(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as HorizontalRayState;
    const origin = worldPointToCanvas(state.anchor, view);
    ctx.strokeStyle = state.style.color ?? DEFAULT_COLOR;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash(dashPattern(state.style.lineStyle ?? "solid"));
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(view.pxWidth, origin.y);
    ctx.stroke();
    ctx.setLineDash([]);
}
