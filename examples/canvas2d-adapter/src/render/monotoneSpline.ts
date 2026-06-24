// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * A single cubic-Bézier segment: the two control points plus the end
 * point. The start point is the previous segment's end (or the path's
 * `moveTo` for the first segment), matching `ctx.bezierCurveTo`.
 *
 * @since 0.3
 * @stable
 * @example
 *     const seg: BezierSegment = { c1x: 1, c1y: 2, c2x: 3, c2y: 4, x: 5, y: 6 };
 *     void seg;
 */
export type BezierSegment = {
    readonly c1x: number;
    readonly c1y: number;
    readonly c2x: number;
    readonly c2y: number;
    readonly x: number;
    readonly y: number;
};

/** A 2-D point in canvas pixel space. */
type Point = { readonly x: number; readonly y: number };

/**
 * Convert a polyline into monotone-cubic Bézier segments (Fritsch–Carlson
 * tangents) so a plot series strokes as a smooth curve that passes
 * **through** every point with **no overshoot** between them — a faceted
 * MA polyline reads as a clean curve at any bar density, but the curve
 * never invents a peak/trough the data does not have (the monotone
 * property that makes splines safe on indicator data).
 *
 * Points are assumed sorted ascending by `x` (bar time → x always is).
 * Returns one {@link BezierSegment} per input gap (`pts.length - 1`); the
 * caller issues `moveTo(pts[0])` then one `bezierCurveTo` per segment.
 * Fewer than two points yields `[]`. A zero/negative-width gap (coincident
 * x) degrades that one segment to a straight line, so the path never
 * divides by zero.
 *
 * @since 0.3
 * @stable
 * @example
 *     const segs = monotoneCubicSegments([
 *         { x: 0, y: 0 },
 *         { x: 1, y: 1 },
 *         { x: 2, y: 0 },
 *     ]);
 *     // segs.length === 2
 *     void segs;
 */
export function monotoneCubicSegments(pts: ReadonlyArray<Point>): BezierSegment[] {
    const n = pts.length;
    if (n < 2) return [];

    // Secant slopes between consecutive points (delta[i] is the slope of the
    // gap pts[i] → pts[i+1]). A zero-width gap has an undefined slope; mark it
    // NaN and render that single gap straight.
    const delta: number[] = new Array(n - 1);
    for (let i = 0; i < n - 1; i += 1) {
        const h = pts[i + 1].x - pts[i].x;
        delta[i] = h <= 0 ? Number.NaN : (pts[i + 1].y - pts[i].y) / h;
    }

    // Tangents m[i] at each point. Endpoints use the adjacent secant; interior
    // points average their two secants, clamped to 0 at local extrema so the
    // curve stays monotone within each gap.
    const m: number[] = new Array(n);
    m[0] = Number.isFinite(delta[0]) ? delta[0] : 0;
    m[n - 1] = Number.isFinite(delta[n - 2]) ? delta[n - 2] : 0;
    for (let i = 1; i < n - 1; i += 1) {
        const d0 = delta[i - 1];
        const d1 = delta[i];
        if (!Number.isFinite(d0) || !Number.isFinite(d1) || d0 * d1 <= 0) {
            m[i] = 0;
        } else {
            m[i] = (d0 + d1) / 2;
        }
    }

    // Fritsch–Carlson: pull each tangent back inside the monotonicity circle
    // (radius 3) so no segment overshoots its endpoints. This is the sequential
    // form — gap `i` may rescale `m[i+1]`, which gap `i+1` can then tighten
    // again. That is intentional (each pass only ever shrinks a tangent, never
    // loosens it, so monotonicity is preserved); do not refactor it to read
    // `m[i+1]` before the write or the clamp stops being conservative.
    for (let i = 0; i < n - 1; i += 1) {
        const d = delta[i];
        if (!Number.isFinite(d) || d === 0) {
            m[i] = 0;
            m[i + 1] = 0;
            continue;
        }
        const alpha = m[i] / d;
        const beta = m[i + 1] / d;
        const s = alpha * alpha + beta * beta;
        if (s > 9) {
            const tau = 3 / Math.sqrt(s);
            m[i] = tau * alpha * d;
            m[i + 1] = tau * beta * d;
        }
    }

    // Hermite → Bézier: control points sit one-third of the gap width along
    // each endpoint tangent.
    const segments: BezierSegment[] = new Array(n - 1);
    for (let i = 0; i < n - 1; i += 1) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const h = p1.x - p0.x;
        if (h <= 0) {
            // Degenerate gap: straight line (control points on the chord).
            segments[i] = { c1x: p0.x, c1y: p0.y, c2x: p1.x, c2y: p1.y, x: p1.x, y: p1.y };
            continue;
        }
        segments[i] = {
            c1x: p0.x + h / 3,
            c1y: p0.y + (m[i] * h) / 3,
            c2x: p1.x - h / 3,
            c2y: p1.y - (m[i + 1] * h) / 3,
            x: p1.x,
            y: p1.y,
        };
    }
    return segments;
}
