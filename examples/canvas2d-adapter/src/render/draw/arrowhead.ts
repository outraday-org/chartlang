// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Arrowhead geometry ported from
//   invinite/src/components/trading-chart/tools/arrow-tool.ts,
//   invinite/src/components/trading-chart/tools/arrow-marker-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { RenderCtx } from "../clear";
import type { Point2 } from "./bezier";

const DEFAULT_ARROWHEAD_SIZE = 8;
const ARROWHEAD_HALF_ANGLE = Math.PI / 6; // 30° each side → 60° total

/**
 * Paint a filled isoceles-triangle arrowhead at `to` pointing along the
 * `from → to` direction. The caller is responsible for setting
 * `fillStyle` before calling; the helper issues `beginPath + moveTo +
 * 2 lineTo + closePath + fill`. Shared by Task-9's `renderArrow` and
 * `renderArrowMarker`.
 *
 * `size` defaults to 8 CSS px (the wing length); pass a larger value
 * for a chunkier arrowhead.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     drawArrowhead(ctx, { x: 0, y: 0 }, { x: 100, y: 0 });
 *     void drawArrowhead;
 */
export function drawArrowhead(
    ctx: RenderCtx,
    from: Point2,
    to: Point2,
    size: number = DEFAULT_ARROWHEAD_SIZE,
): void {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const leftX = to.x - size * Math.cos(angle - ARROWHEAD_HALF_ANGLE);
    const leftY = to.y - size * Math.sin(angle - ARROWHEAD_HALF_ANGLE);
    const rightX = to.x - size * Math.cos(angle + ARROWHEAD_HALF_ANGLE);
    const rightY = to.y - size * Math.sin(angle + ARROWHEAD_HALF_ANGLE);
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
    ctx.fill();
}
