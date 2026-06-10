// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Level + projection semantics ported from
//   invinite/src/components/trading-chart/tools/fib-trend-extension-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FibTrendExtensionState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import { priceToY, timeToX, type Viewport } from "../coords";
import { FIB_LEVELS, formatLevel } from "./fibLevels";

const DEFAULT_COLOR = "#facc15";
const DEFAULT_LINE_WIDTH = 1;
const LABEL_FONT = "12px sans-serif";
const LABEL_OFFSET_PX = 4;

/**
 * Render a `fib-trend-extension` drawing emission. Projects fib-ratio
 * extensions from `anchors[2].price` using the (A→B) leg's price delta
 * (`anchors[1].price − anchors[0].price`). Each projected price renders
 * as a horizontal stroke from `anchors[2].time` rightward to the
 * viewport edge. Reuses Task-4's {@link FIB_LEVELS} as the default
 * level set.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderFibTrendExtension(ctx, e, view);
 *     void renderFibTrendExtension;
 */
export function renderFibTrendExtension(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as FibTrendExtensionState;
    const [A, B, C] = state.anchors;
    const color = state.style.color ?? DEFAULT_COLOR;
    const levels = state.style.levels ?? FIB_LEVELS;
    const priceDelta = B.price - A.price;
    const startX = timeToX(C.time, view);
    const endX = view.pxWidth;
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
        const levelPrice = C.price + level * priceDelta;
        const levelY = priceToY(levelPrice, view);
        ctx.beginPath();
        ctx.moveTo(startX, levelY);
        ctx.lineTo(endX, levelY);
        ctx.stroke();
        if (state.style.showLabels === true) {
            ctx.fillText(formatLevel(level), endX + LABEL_OFFSET_PX, levelY);
        }
    }
}
