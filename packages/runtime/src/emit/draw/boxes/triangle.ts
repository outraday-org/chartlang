// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (TriangleDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/triangle-tool.ts.
// Re-licensed MIT for chartlang.

import type {
    AnchorTriple,
    DrawingHandle,
    ShapeStyle,
    TriangleState,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.triangle called outside an active script step";

function triangleImpl(slotId: string, anchors: AnchorTriple, opts: ShapeStyle): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: TriangleState = { kind: "triangle", anchors, style: opts };
    return createDrawingHandle(slotId, subId, "triangle", state);
}

/**
 * Draw a triangle as a closed three-vertex polygon. Vertices may be
 * supplied CW or CCW; the renderer walks them as a closed path. Not to
 * be confused with `draw.trianglePattern` — that variant is
 * the harmonic five-anchor triangle pattern.
 *
 * @anchors `anchors` — 3 `WorldPoint`s
 * @anchorCount 3
 * @bucket boxes
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.triangle demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.triangle(
 *                 [
 *                     { time: bar.time, price: bar.low },
 *                     { time: bar.time, price: bar.high },
 *                     { time: bar.time, price: bar.close },
 *                 ],
 *                 { stroke: "#ef4444", fill: "#fee2e2", fillAlpha: 0.5 },
 *             );
 *         },
 *     });
 */
export function triangle(anchors: AnchorTriple, opts?: ShapeStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof triangle = triangle;
 *     // void fn;
 */
export function triangle(slotId: string, anchors: AnchorTriple, opts?: ShapeStyle): DrawingHandle;
/**
 * Implementation signature for {@link triangle}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof triangle = triangle;
 *     // void fn;
 */
export function triangle(
    arg1: string | AnchorTriple,
    arg2?: AnchorTriple | ShapeStyle,
    arg3?: ShapeStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return triangleImpl(arg1, arg2 as AnchorTriple, arg3 ?? {});
}
