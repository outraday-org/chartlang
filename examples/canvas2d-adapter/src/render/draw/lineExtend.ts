// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Geometry ported from
//   invinite/src/components/trading-chart/tools/lib/geometry.ts
//     (`extendSegmentPx`), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang.

import type { Viewport } from "../coords.js";

import type { Point2 } from "./bezier.js";

/**
 * Project the segment `(a, b)` to the viewport edges in the directions
 * `opts.extendLeft` / `opts.extendRight`. Used by the `line` renderer
 * (when its `LineDrawStyle` flags are set) and by `horizontal-ray`
 * (always extends right).
 *
 * The projection walks the parametric line `p(t) = a + t·(b − a)` and
 * solves for the `t` that hits `x = 0` (left edge) or `x =
 * viewport.pxWidth` (right edge). A purely vertical segment
 * (`dx === 0`) cannot intersect the x-edges — for that case we return
 * the segment unchanged because the line already spans the full height
 * implicitly (every renderer's stroke clips at the viewport boundary).
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const view: Viewport;
 *     const a: Point2 = { x: 100, y: 100 };
 *     const b: Point2 = { x: 200, y: 200 };
 *     const seg = extendLineSegment(a, b, { extendRight: true }, view);
 *     // seg.from === a; seg.to.x === view.pxWidth
 *     void seg;
 */
export function extendLineSegment(
    a: Point2,
    b: Point2,
    opts: { readonly extendLeft?: boolean | undefined; readonly extendRight?: boolean | undefined },
    view: Viewport,
): { readonly from: Point2; readonly to: Point2 } {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0) return { from: a, to: b };

    let from: Point2 = a;
    let to: Point2 = b;

    if (opts.extendLeft === true) {
        // Extend backwards through `a` until x = 0. Walk against the
        // segment direction so the new `from.x` is at the left edge
        // (which is x=0 when `a.x` is to the right of x=0 along the
        // forward direction `dx`, or to the right when `dx < 0`).
        const t = -a.x / dx;
        from = { x: 0, y: a.y + t * dy };
    }
    if (opts.extendRight === true) {
        const t = (view.pxWidth - b.x) / dx;
        to = { x: view.pxWidth, y: b.y + t * dy };
    }

    return { from, to };
}
