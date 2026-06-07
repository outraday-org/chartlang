// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Vertical-time-projection semantics ported from
//   invinite/src/components/trading-chart/tools/fib-trend-time-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FibTrendTimeState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import { timeToX, type Viewport } from "../coords";
import { FIB_LEVELS, formatLevel } from "./fibLevels";

const DEFAULT_COLOR = "#facc15";
const DEFAULT_LINE_WIDTH = 1;
const LABEL_FONT = "12px sans-serif";
const LABEL_TOP_PX = 12;
const LABEL_OFFSET_PX = 4;

/**
 * Render a `fib-trend-time` drawing emission as a set of vertical
 * strokes at fib-spaced times anchored at the third anchor C. For each
 * level: `t = C.time + level * (B.time − A.time)`, paint a vertical
 * line from `(timeToX(t), 0)` to `(timeToX(t), pxHeight)`. Mirrors
 * `fibTimeZone`'s pattern but anchored at `anchors[2]` with the (A→B)
 * leg as the time-delta unit.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderFibTrendTime(ctx, e, view);
 *     void renderFibTrendTime;
 */
export function renderFibTrendTime(
    ctx: RenderCtx,
    e: DrawingEmission,
    view: Viewport,
): void {
    const state = e.state as FibTrendTimeState;
    const [A, B, C] = state.anchors;
    const color = state.style.color ?? DEFAULT_COLOR;
    const levels = state.style.levels ?? FIB_LEVELS;
    const timeDelta = B.time - A.time;
    ctx.strokeStyle = color;
    ctx.lineWidth = DEFAULT_LINE_WIDTH;
    ctx.setLineDash([]);
    if (state.style.showLabels === true) {
        ctx.font = LABEL_FONT;
        ctx.fillStyle = color;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
    }
    for (const level of levels) {
        const t = C.time + level * timeDelta;
        const tx = timeToX(t, view);
        ctx.beginPath();
        ctx.moveTo(tx, 0);
        ctx.lineTo(tx, view.pxHeight);
        ctx.stroke();
        if (state.style.showLabels === true) {
            ctx.fillText(formatLevel(level), tx + LABEL_OFFSET_PX, LABEL_TOP_PX);
        }
    }
}
