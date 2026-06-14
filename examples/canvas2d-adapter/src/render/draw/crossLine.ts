// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Two-stroke crosshair semantics ported from
//   invinite/src/components/trading-chart/tools/cross-line-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { CrossLineState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";
import { dashPattern } from "../lineDash.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

const DEFAULT_COLOR = "#000000";
const DEFAULT_LINE_WIDTH = 1;

/**
 * Render a `cross-line` drawing emission. Strokes both a horizontal
 * line at `y = priceToY(anchor.price)` from `x = 0` to
 * `x = view.pxWidth`, and a vertical line at
 * `x = timeToX(anchor.time)` from `y = 0` to `y = view.pxHeight`.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderCrossLine(ctx, e, view);
 *     void renderCrossLine;
 */
export function renderCrossLine(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as CrossLineState;
    const p = worldPointToCanvas(state.anchor, view);
    ctx.strokeStyle = state.style.color ?? DEFAULT_COLOR;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash(dashPattern(state.style.lineStyle ?? "solid"));
    // Horizontal stroke.
    ctx.beginPath();
    ctx.moveTo(0, p.y);
    ctx.lineTo(view.pxWidth, p.y);
    ctx.stroke();
    // Vertical stroke.
    ctx.beginPath();
    ctx.moveTo(p.x, 0);
    ctx.lineTo(p.x, view.pxHeight);
    ctx.stroke();
    ctx.setLineDash([]);
}
