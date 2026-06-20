// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Arrowhead geometry ported from
//   invinite/src/components/trading-chart/tools/arrow-tool.ts,
//   invinite/src/components/trading-chart/tools/arrow-marker-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang.

import type { Point2 } from "../types.js";

const DEFAULT_ARROWHEAD_SIZE = 8;
const ARROWHEAD_HALF_ANGLE = Math.PI / 6; // 30° each side → 60° total

/**
 * Return the three vertices of a filled isoceles-triangle arrowhead at
 * `to` pointing along the `from → to` direction. The order is
 * `[tip, leftWing, rightWing]` so a caller paints a closed polyline
 * `moveTo(tip) → lineTo(left) → lineTo(right) → close`. Pure — no `ctx`.
 *
 * `size` defaults to 8 CSS px (the wing length).
 *
 * @since 1.3
 * @stable
 * @example
 *     const tri = arrowheadPolygon({ x: 0, y: 0 }, { x: 100, y: 0 });
 *     // tri[0] === { x: 100, y: 0 } (tip)
 *     void tri;
 */
export function arrowheadPolygon(
    from: Point2,
    to: Point2,
    size: number = DEFAULT_ARROWHEAD_SIZE,
): ReadonlyArray<Point2> {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const left: Point2 = {
        x: to.x - size * Math.cos(angle - ARROWHEAD_HALF_ANGLE),
        y: to.y - size * Math.sin(angle - ARROWHEAD_HALF_ANGLE),
    };
    const right: Point2 = {
        x: to.x - size * Math.cos(angle + ARROWHEAD_HALF_ANGLE),
        y: to.y - size * Math.sin(angle + ARROWHEAD_HALF_ANGLE),
    };
    return [to, left, right];
}
