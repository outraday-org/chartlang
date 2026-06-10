// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Chevron glyph geometry ported from
//   invinite/src/components/trading-chart/tools/arrow-mark-up-tool.ts,
//   invinite/src/components/trading-chart/tools/arrow-mark-down-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { RenderCtx } from "../clear.js";
import type { Point2 } from "./bezier.js";

const DEFAULT_BASE_WIDTH = 12;
const DEFAULT_HEIGHT = 10;

/**
 * Vertical direction of a chevron glyph. `"up"` paints the tip above
 * the anchor (smaller y); `"down"` paints the tip below (larger y).
 *
 * @since 0.3
 * @stable
 * @example
 *     const d: ChevronDirection = "up";
 *     void d;
 */
export type ChevronDirection = "up" | "down";

/**
 * Paint a filled triangle chevron glyph centred on `at`, pointing up
 * or down. Sets `fillStyle = color` before painting and issues
 * `beginPath + moveTo + 2 lineTo + closePath + fill`. Shared by
 * Task-9's `renderArrowMarkUp` and `renderArrowMarkDown`.
 *
 * `baseWidth` defaults to 12 CSS px, `height` to 10 CSS px.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     drawChevron(ctx, { x: 100, y: 100 }, "up", "#22c55e");
 *     void drawChevron;
 */
export function drawChevron(
    ctx: RenderCtx,
    at: Point2,
    direction: ChevronDirection,
    color: string,
    baseWidth: number = DEFAULT_BASE_WIDTH,
    height: number = DEFAULT_HEIGHT,
): void {
    const halfWidth = baseWidth / 2;
    const halfHeight = height / 2;
    const tipY = direction === "up" ? at.y - halfHeight : at.y + halfHeight;
    const baseY = direction === "up" ? at.y + halfHeight : at.y - halfHeight;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(at.x, tipY);
    ctx.lineTo(at.x - halfWidth, baseY);
    ctx.lineTo(at.x + halfWidth, baseY);
    ctx.closePath();
    ctx.fill();
}
