// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (FlatTopBottomDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/flat-top-bottom-tool.ts.
// Re-licensed MIT for chartlang.

import type {
    AnchorTriple,
    DrawingHandle,
    FlatTopBottomState,
    LineDrawStyle,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.flatTopBottom called outside an active script step";

function flatTopBottomImpl(
    slotId: string,
    anchors: AnchorTriple,
    opts: LineDrawStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: FlatTopBottomState = { kind: "flat-top-bottom", anchors, style: opts };
    return createDrawingHandle(slotId, subId, "flat-top-bottom", state);
}

/**
 * Draw a flat-top / flat-bottom channel — two parallel horizontal
 * rails. Anchors `[leftEdge, rightEdge, oppositeHook]`: leftEdge and
 * rightEdge fix the time range; the opposite-edge price comes from
 * `oppositeHook.price`. Mirrors invinite's `flat-top-bottom-tool.ts`
 * shape — note the landed core shape persists 3 anchors.
 *
 * @anchors `anchors` — `[leftEdge, rightEdge, oppositeHook]` triple
 * @anchorCount 3
 * @bucket polylines
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.flatTopBottom demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.flatTopBottom(
 *                 [
 *                     { time: bar.time, price: bar.high },
 *                     { time: bar.time, price: bar.high },
 *                     { time: bar.time, price: bar.low },
 *                 ],
 *                 { color: "#3b82f6", lineStyle: "dashed" },
 *             );
 *         },
 *     });
 */
export function flatTopBottom(anchors: AnchorTriple, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof flatTopBottom = flatTopBottom;
 *     // void fn;
 */
export function flatTopBottom(
    slotId: string,
    anchors: AnchorTriple,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link flatTopBottom}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof flatTopBottom = flatTopBottom;
 *     // void fn;
 */
export function flatTopBottom(
    arg1: string | AnchorTriple,
    arg2?: AnchorTriple | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return flatTopBottomImpl(arg1, arg2 as AnchorTriple, arg3 ?? {});
}
