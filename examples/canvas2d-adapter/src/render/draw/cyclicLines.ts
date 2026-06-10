// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Repeated-vertical-line geometry ported from
//   invinite/src/components/trading-chart/tools/cyclic-lines-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { CyclicLinesState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { dashPattern } from "../lineDash";
import { worldPointToCanvas } from "./worldToCanvas";

const DEFAULT_COLOR = "#0ea5e9";
const DEFAULT_LINE_WIDTH = 1;
const MAX_REPEATS = 256;

/**
 * Render a `cyclic-lines` drawing emission as repeated full-height
 * vertical strokes spaced at `periodPx = |toX - fromX|` to the right of
 * the `from` anchor. Skips silently if the period is non-positive or
 * the first stroke is past the viewport edge.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderCyclicLines(ctx, e, view);
 *     void renderCyclicLines;
 */
export function renderCyclicLines(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as CyclicLinesState;
    const [from, to] = state.anchors;
    const fromPx = worldPointToCanvas(from, view);
    const toPx = worldPointToCanvas(to, view);
    const periodPx = Math.abs(toPx.x - fromPx.x);
    if (!Number.isFinite(periodPx) || periodPx <= 0) return;
    ctx.strokeStyle = state.style.color ?? DEFAULT_COLOR;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash(dashPattern(state.style.lineStyle ?? "solid"));
    for (let k = 0; k < MAX_REPEATS; k++) {
        const x = fromPx.x + k * periodPx;
        if (x > view.pxWidth + 16) break;
        if (x < -16) continue;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, view.pxHeight);
        ctx.stroke();
    }
    ctx.setLineDash([]);
}
