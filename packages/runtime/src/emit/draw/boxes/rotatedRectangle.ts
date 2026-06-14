// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (RotatedRectangleDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/rotated-rectangle-tool.ts.
// Re-licensed MIT for chartlang.

import type {
    AnchorQuad,
    DrawingHandle,
    RotatedRectangleState,
    ShapeStyle,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.rotatedRectangle called outside an active script step";

function rotatedRectangleImpl(
    slotId: string,
    anchors: AnchorQuad,
    opts: ShapeStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: RotatedRectangleState = { kind: "rotated-rectangle", anchors, style: opts };
    return createDrawingHandle(slotId, subId, "rotated-rectangle", state);
}

/**
 * Draw a rotated rectangle by its four world-space corners. The four
 * anchors should be supplied in stroke order (CW or CCW); the renderer
 * walks them as a closed polygon so any non-self-intersecting quad
 * paints correctly. Pure square / axis-aligned input is supported —
 * use {@link rectangle} for that case if you prefer the 2-anchor
 * ergonomics.
 *
 * @anchors `anchors` — 4 `WorldPoint`s in stroke order
 * @anchorCount 4
 * @bucket boxes
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.rotatedRectangle demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.rotatedRectangle(
 *                 [
 *                     { time: bar.time, price: bar.low },
 *                     { time: bar.time, price: bar.high },
 *                     { time: bar.time, price: bar.high + 1 },
 *                     { time: bar.time, price: bar.low + 1 },
 *                 ],
 *                 { stroke: "#22c55e" },
 *             );
 *         },
 *     });
 */
export function rotatedRectangle(anchors: AnchorQuad, opts?: ShapeStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof rotatedRectangle = rotatedRectangle;
 *     // void fn;
 */
export function rotatedRectangle(
    slotId: string,
    anchors: AnchorQuad,
    opts?: ShapeStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link rotatedRectangle}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof rotatedRectangle = rotatedRectangle;
 *     // void fn;
 */
export function rotatedRectangle(
    arg1: string | AnchorQuad,
    arg2?: AnchorQuad | ShapeStyle,
    arg3?: ShapeStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return rotatedRectangleImpl(arg1, arg2 as AnchorQuad, arg3 ?? {});
}
