// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (EllipseDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/ellipse-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    DrawingHandle,
    EllipseState,
    ShapeStyle,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.ellipse called outside an active script step";

function ellipseImpl(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts: ShapeStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: EllipseState = { kind: "ellipse", anchors: [a, b], style: opts };
    return createDrawingHandle(slotId, subId, "ellipse", state);
}

/**
 * Draw an axis-aligned ellipse inscribed in the bounding box of two
 * world anchors. The renderer derives `(centerX, centerY, radiusX,
 * radiusY)` from the projected bbox and paints a polyline
 * approximation. Rotated ellipses (invinite's `widthOffset` form)
 * are out of scope for Phase 3.
 *
 * @anchors `a`, `b` — two `WorldPoint`s (opposite bbox corners)
 * @anchorCount 2
 * @bucket boxes
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.ellipse demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.ellipse(
 *                 { time: bar.time, price: bar.low },
 *                 { time: bar.time, price: bar.high },
 *                 { stroke: "#22c55e", fill: "#dcfce7", fillAlpha: 0.3 },
 *             );
 *         },
 *     });
 */
export function ellipse(a: WorldPoint, b: WorldPoint, opts?: ShapeStyle): DrawingHandle;
/**
 * Compiler-injected overload — the callsite-id transformer rewrites
 * every script-side `draw.ellipse(a, b, opts)` into
 * `draw.ellipse(slotId, a, b, opts)`.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof ellipse = ellipse;
 *     // void fn;
 */
export function ellipse(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts?: ShapeStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link ellipse}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof ellipse = ellipse;
 *     // void fn;
 */
export function ellipse(
    arg1: string | WorldPoint,
    arg2?: WorldPoint,
    arg3?: WorldPoint | ShapeStyle,
    arg4?: ShapeStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || arg3 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return ellipseImpl(arg1, arg2, arg3 as WorldPoint, arg4 ?? {});
}
