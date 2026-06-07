// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Median-origin + median-target formulas ported from
//   invinite/src/components/trading-chart/tools/lib/pitchfork-geometry.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { PitchforkState } from "@invinite-org/chartlang-core";

import type { Point2 } from "./bezier";

type PitchforkVariant = PitchforkState["variant"];

/**
 * Per-variant median-origin point — the first endpoint of the
 * pitchfork's median rail in canvas (pixel) space. The renderer
 * draws three lines: the median (origin → target → +extension) and
 * two parallel handles through `b` and `c` offset by the same
 * `target - origin` vector.
 *
 * Variants:
 * - `standard` — origin = `a`; target = `mid(b, c)`.
 * - `schiff` — origin = `(a.x, mid(a.y, midBC.y))`; target = `mid(b, c)`.
 * - `modifiedSchiff` — origin = `mid(a, b)`; target = `mid(b, c)`.
 * - `inside` — origin = `mid(b, c)`; target = `midBC + (c - midAB)`.
 *
 * Matches invinite's `pitchfork-geometry.ts:118-160` switch.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { medianOriginFor } from "./pitchforkGeom";
 *     const origin = medianOriginFor(
 *         "standard",
 *         { x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 },
 *     );
 *     void origin;
 */
export function medianOriginFor(
    variant: PitchforkVariant,
    a: Point2,
    b: Point2,
    c: Point2,
): Point2 {
    const midBC: Point2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    if (variant === "schiff") {
        return { x: a.x, y: (a.y + midBC.y) / 2 };
    }
    if (variant === "modifiedSchiff") {
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    if (variant === "inside") {
        return midBC;
    }
    return a;
}

/**
 * Per-variant median-target point — the second endpoint of the
 * pitchfork's median rail. Used by the renderer to compute the
 * extension vector `target - origin` that's reused for the two
 * parallel handle rails.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { medianTargetFor } from "./pitchforkGeom";
 *     const target = medianTargetFor(
 *         "standard",
 *         { x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 },
 *     );
 *     void target;
 */
export function medianTargetFor(
    variant: PitchforkVariant,
    a: Point2,
    b: Point2,
    c: Point2,
): Point2 {
    const midBC: Point2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    if (variant === "inside") {
        const midAB: Point2 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        return { x: midBC.x + (c.x - midAB.x), y: midBC.y + (c.y - midAB.y) };
    }
    return midBC;
}
