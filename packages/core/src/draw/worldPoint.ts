// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Price, Time } from "../types.js";

/**
 * World coordinate — `(time, price)` is the only persisted frame for
 * drawings. The adapter projects to its own pixel space when rendering.
 *
 * @formula  identity — no transform; world-space (time, price) tuple
 * @anchors  time, price
 * @since 0.3
 * @stable
 * @example
 *     const anchor: WorldPoint = { time: 1_700_000_000_000, price: 42.31 };
 *     void anchor;
 */
export type WorldPoint = {
    readonly time: Time;
    readonly price: Price;
};

/**
 * Two anchor points — e.g. the two endpoints of a line, the two corners
 * of an axis-aligned rectangle.
 *
 * @formula  identity — readonly tuple of two `WorldPoint`s
 * @anchors  [WorldPoint, WorldPoint]
 * @since 0.3
 * @stable
 * @example
 *     const segment: AnchorPair = [
 *         { time: 1_700_000_000_000, price: 100 },
 *         { time: 1_700_086_400_000, price: 110 },
 *     ];
 *     void segment;
 */
export type AnchorPair = readonly [WorldPoint, WorldPoint];

/**
 * Three anchor points — e.g. triangle vertices, pitchfork pivot + two
 * extreme highs/lows.
 *
 * @formula  identity — readonly tuple of three `WorldPoint`s
 * @anchors  [WorldPoint, WorldPoint, WorldPoint]
 * @since 0.3
 * @stable
 * @example
 *     const tri: AnchorTriple = [
 *         { time: 1, price: 1 },
 *         { time: 2, price: 2 },
 *         { time: 3, price: 1 },
 *     ];
 *     void tri;
 */
export type AnchorTriple = readonly [WorldPoint, WorldPoint, WorldPoint];

/**
 * Four anchor points — e.g. ABCD harmonic pattern legs, rotated
 * rectangle corners.
 *
 * @formula  identity — readonly tuple of four `WorldPoint`s
 * @anchors  [WorldPoint × 4]
 * @since 0.3
 * @stable
 * @example
 *     const abcd: AnchorQuad = [
 *         { time: 1, price: 1 },
 *         { time: 2, price: 2 },
 *         { time: 3, price: 1.5 },
 *         { time: 4, price: 3 },
 *     ];
 *     void abcd;
 */
export type AnchorQuad = readonly [WorldPoint, WorldPoint, WorldPoint, WorldPoint];

/**
 * Five anchor points — e.g. XABCD harmonic pattern legs,
 * head-and-shoulders pivots, Elliott impulse waves.
 *
 * @formula  identity — readonly tuple of five `WorldPoint`s
 * @anchors  [WorldPoint × 5]
 * @since 0.3
 * @stable
 * @example
 *     const xabcd: AnchorQuint = [
 *         { time: 1, price: 1 },
 *         { time: 2, price: 2 },
 *         { time: 3, price: 1.5 },
 *         { time: 4, price: 3 },
 *         { time: 5, price: 2 },
 *     ];
 *     void xabcd;
 */
export type AnchorQuint = readonly [WorldPoint, WorldPoint, WorldPoint, WorldPoint, WorldPoint];

/**
 * Seven anchor points — e.g. Elliott triple-combo legs, double-curve
 * control points.
 *
 * @formula  identity — readonly tuple of seven `WorldPoint`s
 * @anchors  [WorldPoint × 7]
 * @since 0.3
 * @stable
 * @example
 *     const triple: AnchorHept = [
 *         { time: 1, price: 1 }, { time: 2, price: 2 },
 *         { time: 3, price: 1.5 }, { time: 4, price: 3 },
 *         { time: 5, price: 2 }, { time: 6, price: 4 },
 *         { time: 7, price: 3 },
 *     ];
 *     void triple;
 */
export type AnchorHept = readonly [
    WorldPoint,
    WorldPoint,
    WorldPoint,
    WorldPoint,
    WorldPoint,
    WorldPoint,
    WorldPoint,
];
