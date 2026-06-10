// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingKind } from "./drawingKind.js";

/**
 * Canonical bucket name a {@link DrawingKind} maps to under the
 * `DrawingCounts` 5-bag budget (`{ lines, labels, boxes, polylines,
 * other }`). The adapter-kit `Capabilities.maxDrawingsPerScript` and
 * the script-side `ScriptManifest.maxDrawings?` both pin the same five
 * bucket names. The runtime budget enforcer counts emissions per
 * bucket and drops the overflow with `drawing-budget-exceeded`.
 *
 * @formula  bucket = KIND_BUCKET.get(kind)
 * @anchors  kind: DrawingKind → bucket: "lines"|"labels"|"boxes"|"polylines"|"other"
 * @since 0.3
 * @stable
 * @example
 *     const b: DrawingBucket = "lines";
 *     void b;
 */
export type DrawingBucket = "lines" | "labels" | "boxes" | "polylines" | "other";

/**
 * Per-kind bucket assignment. Pinned table; every entry of
 * {@link DrawingKind} appears exactly once (asserted by
 * `buckets.test.ts`).
 *
 * Mapping rationale (Phase-3 task README §"Architecture Decisions"):
 * lines/rays/horizontalLine/verticalLine/crossLine/trendAngle → `lines`;
 * rectangle/rotatedRectangle/triangle/circle/ellipse → `boxes`;
 * path/polyline/curves/freehand/channels/pitchforks/patterns/elliott →
 * `polylines`; text/arrow/arrowMarker/arrowMarkUp/arrowMarkDown +
 * marker → `labels`; fib / gann / cycles / containers / table → `other`.
 *
 * @formula  bucket = KIND_BUCKET.get(kind)
 * @anchors  kind: DrawingKind → bucket: "lines"|"labels"|"boxes"|"polylines"|"other"
 * @since 0.3
 * @stable
 * @example
 *     import { KIND_BUCKET } from "@invinite-org/chartlang-core";
 *     const b = KIND_BUCKET.get("fib-retracement"); // "other"
 *     void b;
 */
export const KIND_BUCKET: ReadonlyMap<DrawingKind, DrawingBucket> = new Map<
    DrawingKind,
    DrawingBucket
>([
    ["line", "lines"],
    ["horizontal-line", "lines"],
    ["horizontal-ray", "lines"],
    ["vertical-line", "lines"],
    ["cross-line", "lines"],
    ["trend-angle", "lines"],
    ["rectangle", "boxes"],
    ["rotated-rectangle", "boxes"],
    ["triangle", "boxes"],
    ["polyline", "polylines"],
    ["circle", "boxes"],
    ["ellipse", "boxes"],
    ["path", "polylines"],
    ["marker", "labels"],
    ["arc", "polylines"],
    ["curve", "polylines"],
    ["double-curve", "polylines"],
    ["pen", "polylines"],
    ["highlighter", "polylines"],
    ["brush", "polylines"],
    ["text", "labels"],
    ["arrow", "labels"],
    ["arrow-marker", "labels"],
    ["arrow-mark-up", "labels"],
    ["arrow-mark-down", "labels"],
    ["trend-channel", "polylines"],
    ["flat-top-bottom", "polylines"],
    ["disjoint-channel", "polylines"],
    ["regression-trend", "polylines"],
    ["fib-retracement", "other"],
    ["fib-trend-extension", "other"],
    ["fib-channel", "other"],
    ["fib-time-zone", "other"],
    ["fib-wedge", "other"],
    ["fib-speed-fan", "other"],
    ["fib-speed-arcs", "other"],
    ["fib-spiral", "other"],
    ["fib-circles", "other"],
    ["fib-trend-time", "other"],
    ["gann-box", "other"],
    ["gann-square-fixed", "other"],
    ["gann-square", "other"],
    ["gann-fan", "other"],
    ["pitchfork", "polylines"],
    ["pitchfan", "polylines"],
    ["xabcd-pattern", "polylines"],
    ["cypher-pattern", "polylines"],
    ["head-and-shoulders", "polylines"],
    ["abcd-pattern", "polylines"],
    ["triangle-pattern", "polylines"],
    ["three-drives-pattern", "polylines"],
    ["elliott-impulse-wave", "polylines"],
    ["elliott-correction-wave", "polylines"],
    ["elliott-triangle-wave", "polylines"],
    ["elliott-double-combo", "polylines"],
    ["elliott-triple-combo", "polylines"],
    ["cyclic-lines", "other"],
    ["time-cycles", "other"],
    ["sine-line", "other"],
    ["group", "other"],
    ["frame", "other"],
    ["table", "other"],
]);

/**
 * Return the {@link DrawingBucket} for a given {@link DrawingKind}.
 * Throws if the kind is not in the map — covers the defensive branch
 * for callers that pass an unverified string (e.g. a future kind
 * round-tripped from the wire before its bucket entry lands).
 *
 * @formula  bucket = KIND_BUCKET.get(kind)
 * @anchors  kind: DrawingKind → bucket: "lines"|"labels"|"boxes"|"polylines"|"other"
 * @since 0.3
 * @stable
 * @example
 *     import { bucketFor } from "@invinite-org/chartlang-core";
 *     const bucket = bucketFor("rectangle"); // "boxes"
 *     void bucket;
 */
export function bucketFor(kind: DrawingKind): DrawingBucket {
    const bucket = KIND_BUCKET.get(kind);
    if (bucket === undefined) {
        throw new Error(`No bucket assigned for drawing kind '${kind}'`);
    }
    return bucket;
}
