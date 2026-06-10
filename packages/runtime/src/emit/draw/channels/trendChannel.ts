// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (TrendChannelDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/trend-channel-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    AnchorTriple,
    DrawingHandle,
    LineDrawStyle,
    TrendChannelState,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.trendChannel called outside an active script step";

function trendChannelImpl(
    slotId: string,
    anchors: AnchorTriple,
    opts: LineDrawStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: TrendChannelState = { kind: "trend-channel", anchors, style: opts };
    return createDrawingHandle(slotId, subId, "trend-channel", state);
}

/**
 * Draw a parallel-line trend channel from three world anchors
 * `[primaryA, primaryB, parallelHook]`. The first two define the
 * primary trend line; the third is offset perpendicular to that line
 * to determine the parallel rail. Mirrors invinite's
 * `trend-channel-tool.ts` shape.
 *
 * @anchors `anchors` — `[primaryA, primaryB, parallelHook]` triple
 * @anchorCount 3
 * @bucket polylines
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.trendChannel demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.trendChannel(
 *                 [
 *                     { time: bar.time, price: bar.low },
 *                     { time: bar.time, price: bar.high },
 *                     { time: bar.time, price: bar.close },
 *                 ],
 *                 { color: "#3b82f6", lineWidth: 2 },
 *             );
 *         },
 *     });
 */
export function trendChannel(anchors: AnchorTriple, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof trendChannel = trendChannel;
 *     // void fn;
 */
export function trendChannel(
    slotId: string,
    anchors: AnchorTriple,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link trendChannel}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof trendChannel = trendChannel;
 *     // void fn;
 */
export function trendChannel(
    arg1: string | AnchorTriple,
    arg2?: AnchorTriple | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return trendChannelImpl(arg1, arg2 as AnchorTriple, arg3 ?? {});
}
