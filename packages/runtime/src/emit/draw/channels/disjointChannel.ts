// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (DisjointChannelDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/disjoint-channel-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    AnchorQuad,
    DisjointChannelState,
    DrawingHandle,
    LineDrawStyle,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.disjointChannel called outside an active script step";

function disjointChannelImpl(
    slotId: string,
    anchors: AnchorQuad,
    opts: LineDrawStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: DisjointChannelState = { kind: "disjoint-channel", anchors, style: opts };
    return createDrawingHandle(slotId, subId, "disjoint-channel", state);
}

/**
 * Draw a disjoint channel — two independent line segments. Anchors
 * `[A, B, C, D]`: segment 1 from A to B, segment 2 from C to D, with
 * no shared geometry constraint. Mirrors invinite's
 * `disjoint-channel-tool.ts` shape.
 *
 * @anchors `anchors` — `[A, B, C, D]` quad
 * @anchorCount 4
 * @bucket polylines
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.disjointChannel demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.disjointChannel(
 *                 [
 *                     { time: bar.time, price: bar.low },
 *                     { time: bar.time, price: bar.high },
 *                     { time: bar.time, price: bar.open },
 *                     { time: bar.time, price: bar.close },
 *                 ],
 *                 { color: "#3b82f6", lineWidth: 2 },
 *             );
 *         },
 *     });
 */
export function disjointChannel(anchors: AnchorQuad, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof disjointChannel = disjointChannel;
 *     // void fn;
 */
export function disjointChannel(
    slotId: string,
    anchors: AnchorQuad,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link disjointChannel}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof disjointChannel = disjointChannel;
 *     // void fn;
 */
export function disjointChannel(
    arg1: string | AnchorQuad,
    arg2?: AnchorQuad | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return disjointChannelImpl(arg1, arg2 as AnchorQuad, arg3 ?? {});
}
