// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Level + extension semantics ported from
//   invinite/src/components/trading-chart/tools/fib-retracement-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FibRetracementState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import { priceToY, type Viewport } from "../coords.js";
import { FIB_LEVELS, formatLevel } from "./fibLevels.js";
import { extendLineSegment } from "./lineExtend.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

const DEFAULT_COLOR = "#facc15";
const DEFAULT_LINE_WIDTH = 1;
const LABEL_FONT = "12px sans-serif";
const LABEL_OFFSET_PX = 4;

/**
 * Render a `fib-retracement` drawing emission as one horizontal line
 * per Fibonacci level between `anchors[0].price` and `anchors[1].price`.
 * Reuses Task-4's {@link FIB_LEVELS} as the default level set when
 * `style.levels` is omitted; honours `style.extendLeft` /
 * `style.extendRight` via {@link extendLineSegment}. Optional
 * `style.showLabels` paints `formatLevel(level)` at the right edge of
 * each rail.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderFibRetracement(ctx, e, view);
 *     void renderFibRetracement;
 */
export function renderFibRetracement(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as FibRetracementState;
    const a = worldPointToCanvas(state.anchors[0], view);
    const b = worldPointToCanvas(state.anchors[1], view);
    const color = state.style.color ?? DEFAULT_COLOR;
    const levels = state.style.levels ?? FIB_LEVELS;
    const fromPrice = state.anchors[0].price;
    const toPrice = state.anchors[1].price;
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
        const levelPrice = fromPrice + level * (toPrice - fromPrice);
        const levelY = priceToY(levelPrice, view);
        const { from, to } = extendLineSegment(
            { x: a.x, y: levelY },
            { x: b.x, y: levelY },
            { extendLeft: state.style.extendLeft, extendRight: state.style.extendRight },
            view,
        );
        ctx.beginPath();
        ctx.moveTo(from.x, levelY);
        ctx.lineTo(to.x, levelY);
        ctx.stroke();
        if (state.style.showLabels === true) {
            ctx.fillText(formatLevel(level), to.x + LABEL_OFFSET_PX, levelY);
        }
    }
}
