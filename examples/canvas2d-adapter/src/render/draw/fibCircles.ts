// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Concentric-circle + fib-radius semantics ported from
//   invinite/src/components/trading-chart/tools/fib-circles-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FibCirclesState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";
import { FIB_LEVELS, formatLevel } from "./fibLevels.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

const DEFAULT_COLOR = "#facc15";
const DEFAULT_LINE_WIDTH = 1;
const LABEL_FONT = "12px sans-serif";
const LABEL_OFFSET_PX = 4;
const TAU = Math.PI * 2;

/**
 * Render a `fib-circles` drawing emission as concentric full circles
 * centred at `anchors[0]` (the centre) with radii `level * R₀` where
 * `R₀ = |anchors[1] − anchors[0]|` (the radius-point distance) in
 * canvas space. Reuses Task-4's {@link FIB_LEVELS} as the default level
 * set (uses ratios, NOT the integer Fibonacci sequence — see
 * `tasks/phase-3-drawing-parity/12-fibonacci-b.plan.md` §4).
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderFibCircles(ctx, e, view);
 *     void renderFibCircles;
 */
export function renderFibCircles(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as FibCirclesState;
    const centre = worldPointToCanvas(state.anchors[0], view);
    const radiusPoint = worldPointToCanvas(state.anchors[1], view);
    const color = state.style.color ?? DEFAULT_COLOR;
    const levels = state.style.levels ?? FIB_LEVELS;
    const r0 = Math.hypot(radiusPoint.x - centre.x, radiusPoint.y - centre.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = DEFAULT_LINE_WIDTH;
    ctx.setLineDash([]);
    if (state.style.showLabels === true) {
        ctx.font = LABEL_FONT;
        ctx.fillStyle = color;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
    }
    for (const level of levels) {
        const radius = level * r0;
        ctx.beginPath();
        ctx.arc(centre.x, centre.y, radius, 0, TAU);
        ctx.stroke();
        if (state.style.showLabels === true) {
            ctx.fillText(formatLevel(level), centre.x + radius + LABEL_OFFSET_PX, centre.y);
        }
    }
}
