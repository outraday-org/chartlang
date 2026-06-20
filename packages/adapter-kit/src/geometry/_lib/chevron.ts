// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Chevron glyph geometry ported from
//   invinite/src/components/trading-chart/tools/arrow-mark-up-tool.ts,
//   invinite/src/components/trading-chart/tools/arrow-mark-down-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang.

import type { Point2 } from "../types.js";

const DEFAULT_BASE_WIDTH = 12;
const DEFAULT_HEIGHT = 10;

/**
 * Vertical direction of a chevron glyph. `"up"` puts the tip above the
 * anchor (smaller y); `"down"` puts the tip below (larger y).
 *
 * @since 1.3
 * @stable
 * @example
 *     const d: ChevronDirection = "up";
 *     void d;
 */
export type ChevronDirection = "up" | "down";

/**
 * Return the three vertices of a filled triangle chevron glyph centred
 * on `at`, pointing up or down. The order is `[tip, baseLeft,
 * baseRight]` so a caller paints a closed polyline. Pure — no `ctx`.
 * Consumed by the `arrow-mark-up` / `arrow-mark-down` decomposers.
 *
 * `baseWidth` defaults to 12 CSS px, `height` to 10 CSS px.
 *
 * @since 1.3
 * @stable
 * @example
 *     const tri = chevronPolygon({ x: 100, y: 100 }, "up");
 *     // tri[0].y === 95 (tip is half the height above the anchor)
 *     void tri;
 */
export function chevronPolygon(
    at: Point2,
    direction: ChevronDirection,
    baseWidth: number = DEFAULT_BASE_WIDTH,
    height: number = DEFAULT_HEIGHT,
): ReadonlyArray<Point2> {
    const halfWidth = baseWidth / 2;
    const halfHeight = height / 2;
    const tipY = direction === "up" ? at.y - halfHeight : at.y + halfHeight;
    const baseY = direction === "up" ? at.y + halfHeight : at.y - halfHeight;
    return [
        { x: at.x, y: tipY },
        { x: at.x - halfWidth, y: baseY },
        { x: at.x + halfWidth, y: baseY },
    ];
}
