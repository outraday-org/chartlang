// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Concentric-arc geometry ported from
//   invinite/src/components/trading-chart/tools/time-cycles-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { TimeCyclesState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";
import { dashPattern } from "../lineDash.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

const DEFAULT_COLOR = "#0ea5e9";
const DEFAULT_LINE_WIDTH = 1;
const MAX_REPEATS_PER_SIDE = 64;

/**
 * Render a `time-cycles` drawing emission as concentric upper-half arcs
 * centred at the midpoint of `(from, to)` on the `from.price` baseline.
 * Arcs tile across the viewport at multiples of the diameter
 * `|toX - fromX|`. Skips silently if the diameter is non-positive.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderTimeCycles(ctx, e, view);
 *     void renderTimeCycles;
 */
export function renderTimeCycles(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as TimeCyclesState;
    const [from, to] = state.anchors;
    const fromPx = worldPointToCanvas(from, view);
    const toPx = worldPointToCanvas(to, view);
    const diameter = Math.abs(toPx.x - fromPx.x);
    if (!Number.isFinite(diameter) || diameter <= 0) return;
    const radius = diameter / 2;
    const baselineY = fromPx.y;
    const primaryCx = (fromPx.x + toPx.x) / 2;
    ctx.strokeStyle = state.style.color ?? DEFAULT_COLOR;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash(dashPattern(state.style.lineStyle ?? "solid"));
    const strokeArc = (cx: number): void => {
        ctx.beginPath();
        ctx.arc(cx, baselineY, radius, Math.PI, 2 * Math.PI);
        ctx.stroke();
    };
    strokeArc(primaryCx);
    for (let k = 1; k < MAX_REPEATS_PER_SIDE; k++) {
        const cx = primaryCx + k * diameter;
        if (cx - radius > view.pxWidth + 16) {
            strokeArc(cx);
            break;
        }
        strokeArc(cx);
    }
    for (let k = 1; k < MAX_REPEATS_PER_SIDE; k++) {
        const cx = primaryCx - k * diameter;
        if (cx + radius < -16) {
            strokeArc(cx);
            break;
        }
        strokeArc(cx);
    }
    ctx.setLineDash([]);
}
