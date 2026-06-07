// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (RectangleDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/rectangle-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    DrawingHandle,
    RectangleState,
    ShapeStyle,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.rectangle called outside an active script step";

function rectangleImpl(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts: ShapeStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: RectangleState = { kind: "rectangle", anchors: [a, b], style: opts };
    return createDrawingHandle(slotId, subId, "rectangle", state);
}

/**
 * Draw an axis-aligned rectangle defined by two opposite world corners.
 * The renderer projects each anchor with the adapter's viewport
 * transform; degenerate (zero-area) inputs render as a single line.
 *
 * @anchors `a`, `b` — two `WorldPoint`s (opposite corners)
 * @anchorCount 2
 * @bucket boxes
 * @since 0.3
 * @experimental
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.rectangle demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.rectangle(
 *                 { time: bar.time, price: bar.low },
 *                 { time: bar.time, price: bar.high },
 *                 { stroke: "#3b82f6", fill: "#dbeafe", fillAlpha: 0.4 },
 *             );
 *         },
 *     });
 */
export function rectangle(a: WorldPoint, b: WorldPoint, opts?: ShapeStyle): DrawingHandle;
/**
 * Compiler-injected overload — the callsite-id transformer rewrites
 * every script-side `draw.rectangle(a, b, opts)` into
 * `draw.rectangle(slotId, a, b, opts)`.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof rectangle = rectangle;
 *     // void fn;
 */
export function rectangle(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts?: ShapeStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link rectangle}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const fn: typeof rectangle = rectangle;
 *     // void fn;
 */
export function rectangle(
    arg1: string | WorldPoint,
    arg2?: WorldPoint,
    arg3?: WorldPoint | ShapeStyle,
    arg4?: ShapeStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || arg3 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return rectangleImpl(arg1, arg2, arg3 as WorldPoint, arg4 ?? {});
}
