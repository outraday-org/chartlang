// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (CircleDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/circle-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    CircleState,
    DrawingHandle,
    ShapeStyle,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.circle called outside an active script step";

function circleImpl(
    slotId: string,
    centre: WorldPoint,
    radiusAnchor: WorldPoint,
    opts: ShapeStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: CircleState = {
        kind: "circle",
        anchors: [centre, radiusAnchor],
        style: opts,
    };
    return createDrawingHandle(slotId, subId, "circle", state);
}

/**
 * Draw a circle defined by a centre + an edge anchor. The radius is
 * derived in canvas-pixel space at render time from the projected
 * distance between the two anchors (`|edge - centre|`) — persisting
 * two world points keeps round-trip fidelity across zoom changes
 * (matches invinite's `circle-tool.ts`).
 *
 * @anchors `centre`, `radiusAnchor` — two `WorldPoint`s
 * @anchorCount 2
 * @bucket boxes
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.circle demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.circle(
 *                 { time: bar.time, price: bar.close },
 *                 { time: bar.time, price: bar.high },
 *                 { stroke: "#3b82f6", fill: "#dbeafe", fillAlpha: 0.3 },
 *             );
 *         },
 *     });
 */
export function circle(
    centre: WorldPoint,
    radiusAnchor: WorldPoint,
    opts?: ShapeStyle,
): DrawingHandle;
/**
 * Compiler-injected overload — the callsite-id transformer rewrites
 * every script-side `draw.circle(centre, radiusAnchor, opts)` into
 * `draw.circle(slotId, centre, radiusAnchor, opts)`.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof circle = circle;
 *     // void fn;
 */
export function circle(
    slotId: string,
    centre: WorldPoint,
    radiusAnchor: WorldPoint,
    opts?: ShapeStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link circle}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof circle = circle;
 *     // void fn;
 */
export function circle(
    arg1: string | WorldPoint,
    arg2?: WorldPoint,
    arg3?: WorldPoint | ShapeStyle,
    arg4?: ShapeStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || arg3 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return circleImpl(arg1, arg2, arg3 as WorldPoint, arg4 ?? {});
}
