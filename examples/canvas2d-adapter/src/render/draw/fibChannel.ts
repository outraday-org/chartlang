// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Level + parallel-translate semantics ported from
//   invinite/src/components/trading-chart/tools/fib-channel-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FibChannelState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";
import { FIB_LEVELS, formatLevel } from "./fibLevels.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

const DEFAULT_COLOR = "#facc15";
const DEFAULT_LINE_WIDTH = 1;
const LABEL_FONT = "12px sans-serif";
const LABEL_OFFSET_PX = 4;

/**
 * Render a `fib-channel` drawing emission. Strokes one parallel rail
 * per Fibonacci level: each rail translates the primary `(anchors[0],
 * anchors[1])` line by `level * (canvasC.y − canvasA.y)` in canvas
 * space (matches invinite's `fib-channel-tool.ts` vertical-offset
 * convention). Reuses Task-4's {@link FIB_LEVELS} as the default level
 * set.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderFibChannel(ctx, e, view);
 *     void renderFibChannel;
 */
export function renderFibChannel(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as FibChannelState;
    const a = worldPointToCanvas(state.anchors[0], view);
    const b = worldPointToCanvas(state.anchors[1], view);
    const c = worldPointToCanvas(state.anchors[2], view);
    const color = state.style.color ?? DEFAULT_COLOR;
    const levels = state.style.levels ?? FIB_LEVELS;
    const offsetUnit = c.y - a.y;
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
        const offsetY = level * offsetUnit;
        const fromY = a.y + offsetY;
        const toY = b.y + offsetY;
        ctx.beginPath();
        ctx.moveTo(a.x, fromY);
        ctx.lineTo(b.x, toY);
        ctx.stroke();
        if (state.style.showLabels === true) {
            ctx.fillText(formatLevel(level), b.x + LABEL_OFFSET_PX, toY);
        }
    }
}
