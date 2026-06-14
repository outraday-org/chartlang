// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Stroke + viewport-edge endpoint semantics ported from
//   invinite/src/components/trading-chart/tools/vertical-line-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { VerticalLineState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import { timeToX, type Viewport } from "../coords.js";
import { dashPattern } from "../lineDash.js";

const DEFAULT_COLOR = "#000000";
const DEFAULT_LINE_WIDTH = 1;

/**
 * Render a `vertical-line` drawing emission. Strokes from `y = 0` to
 * `y = view.pxHeight` at `timeToX(state.time)`.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderVerticalLine(ctx, e, view);
 *     void renderVerticalLine;
 */
export function renderVerticalLine(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as VerticalLineState;
    const x = timeToX(state.time, view);
    ctx.strokeStyle = state.style.color ?? DEFAULT_COLOR;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash(dashPattern(state.style.lineStyle ?? "solid"));
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, view.pxHeight);
    ctx.stroke();
    ctx.setLineDash([]);
}
