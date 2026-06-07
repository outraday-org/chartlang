// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// State shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (FrameDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// No standalone tool source exists in invinite — frames are
// metadata-only collab containers; the chartlang port adds the
// `anchors: AnchorPair` payload so frames render as a visible
// rectangle at the wire level per PLAN.md §10.4.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    DrawingHandle,
    FrameOpts,
    FrameState,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.frame called outside an active script step";

function frameImpl(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts: FrameOpts,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: FrameState = {
        kind: "frame",
        anchors: [a, b],
        childHandleIds: [],
        style: opts,
    };
    return createDrawingHandle(slotId, subId, "frame", state);
}

/**
 * Draw a labelled rectangular frame between two world anchors
 * `[topLeft, bottomRight]`. The frame renders an outlined rectangle
 * plus an optional background fill (`opts.bgColor`) and label
 * (`opts.label`) per PLAN.md §10.4. Children of the frame render
 * themselves — the frame is a visual envelope, not a re-render layer.
 *
 * @anchors `a`, `b` — two `WorldPoint`s `(topLeft, bottomRight)`
 * @anchorCount 2
 * @bucket other
 * @since 0.3
 * @experimental
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.frame demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.frame(
 *                 { time: bar.time, price: bar.low },
 *                 { time: bar.time + 60_000, price: bar.high },
 *                 { label: "Trade idea", bgColor: "#f1f5f9" },
 *             );
 *         },
 *     });
 */
export function frame(a: WorldPoint, b: WorldPoint, opts?: FrameOpts): DrawingHandle;
/**
 * Compiler-injected overload — the callsite-id transformer rewrites
 * every script-side `draw.frame(a, b, opts)` into
 * `draw.frame(slotId, a, b, opts)`.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof frame = frame;
 *     // void fn;
 */
export function frame(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts?: FrameOpts,
): DrawingHandle;
/**
 * Implementation signature for {@link frame}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const fn: typeof frame = frame;
 *     // void fn;
 */
export function frame(
    arg1: string | WorldPoint,
    arg2?: WorldPoint,
    arg3?: WorldPoint | FrameOpts,
    arg4?: FrameOpts,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || arg3 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return frameImpl(arg1, arg2, arg3 as WorldPoint, arg4 ?? {});
}
