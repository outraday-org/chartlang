// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Stroke + viewport-edge endpoint semantics ported from
//   invinite/src/components/trading-chart/tools/horizontal-line-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { HorizontalLineState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import { priceToY, type Viewport } from "../coords";
import { dashPattern } from "../lineDash";

const DEFAULT_COLOR = "#000000";
const DEFAULT_LINE_WIDTH = 1;

/**
 * Render a `horizontal-line` drawing emission. Strokes from `x = 0` to
 * `x = view.pxWidth` at `priceToY(state.price)`.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderHorizontalLine(ctx, e, view);
 *     void renderHorizontalLine;
 */
export function renderHorizontalLine(
    ctx: RenderCtx,
    e: DrawingEmission,
    view: Viewport,
): void {
    const state = e.state as HorizontalLineState;
    const y = priceToY(state.price, view);
    ctx.strokeStyle = state.style.color ?? DEFAULT_COLOR;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash(dashPattern(state.style.lineStyle ?? "solid"));
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(view.pxWidth, y);
    ctx.stroke();
    ctx.setLineDash([]);
}
