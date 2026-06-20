// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Point2 } from "../types.js";

/**
 * Evaluate a quadratic Bezier curve at parameter `t ∈ [0, 1]`. The
 * curve interpolates `p0` (at `t = 0`) and `p2` (at `t = 1`) with `p1`
 * as the off-curve control point. Endpoints are float-exact:
 * `quadraticBezier(p0, p1, p2, 0) === p0` and `… 1) === p2`.
 *
 * @since 1.3
 * @stable
 * @example
 *     const mid = quadraticBezier({ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 0 }, 0.5);
 *     // mid.x === 1; mid.y === 1
 *     void mid;
 */
export function quadraticBezier(p0: Point2, p1: Point2, p2: Point2, t: number): Point2 {
    const u = 1 - t;
    return {
        x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
        y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    };
}

/**
 * Evaluate a cubic Bezier curve at parameter `t ∈ [0, 1]`. The curve
 * interpolates `p0` (at `t = 0`) and `p3` (at `t = 1`) with `p1` and
 * `p2` as the two off-curve control points. Endpoints are float-exact.
 *
 * @since 1.3
 * @stable
 * @example
 *     const start = cubicBezier(
 *         { x: 0, y: 0 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 0 }, 0,
 *     );
 *     // start === { x: 0, y: 0 }
 *     void start;
 */
export function cubicBezier(p0: Point2, p1: Point2, p2: Point2, p3: Point2, t: number): Point2 {
    const u = 1 - t;
    const uu = u * u;
    const tt = t * t;
    return {
        x: uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x,
        y: uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y,
    };
}

/**
 * Sample a quadratic Bezier into `samples + 1` points evenly spaced in
 * parameter `t ∈ [0, 1]`. The first sample is `p0`, the last is `p2`.
 *
 * @since 1.3
 * @stable
 * @example
 *     const pts = sampleQuadratic({ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 0 }, 4);
 *     // pts.length === 5; pts[0] === { x: 0, y: 0 }; pts[4] === { x: 2, y: 0 }
 *     void pts;
 */
export function sampleQuadratic(
    p0: Point2,
    p1: Point2,
    p2: Point2,
    samples: number,
): ReadonlyArray<Point2> {
    const out: Point2[] = [];
    for (let i = 0; i <= samples; i++) {
        out.push(quadraticBezier(p0, p1, p2, i / samples));
    }
    return out;
}

/**
 * Sample a cubic Bezier into `samples + 1` points evenly spaced in
 * parameter `t ∈ [0, 1]`. Mirrors {@link sampleQuadratic}.
 *
 * @since 1.3
 * @stable
 * @example
 *     const pts = sampleCubic(
 *         { x: 0, y: 0 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 0 }, 8,
 *     );
 *     // pts.length === 9; pts[0] === { x: 0, y: 0 }; pts[8] === { x: 3, y: 0 }
 *     void pts;
 */
export function sampleCubic(
    p0: Point2,
    p1: Point2,
    p2: Point2,
    p3: Point2,
    samples: number,
): ReadonlyArray<Point2> {
    const out: Point2[] = [];
    for (let i = 0; i <= samples; i++) {
        out.push(cubicBezier(p0, p1, p2, p3, i / samples));
    }
    return out;
}
