// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (FibChannelDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/fib-channel-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    AnchorTriple,
    DrawingHandle,
    FibChannelState,
    FibOpts,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.fibChannel called outside an active script step";

function fibChannelImpl(
    slotId: string,
    anchors: AnchorTriple,
    opts: FibOpts,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: FibChannelState = { kind: "fib-channel", anchors, style: opts };
    return createDrawingHandle(slotId, subId, "fib-channel", state);
}

/**
 * Draw a Fibonacci channel — parallel translates of `line(anchors[0],
 * anchors[1])` at fib-ratio offsets through `anchors[2]`. Mirrors
 * invinite's `fib-channel-tool.ts` shape.
 *
 * @anchors `anchors` — `[A, B, C]` triple
 * @anchorCount 3
 * @bucket other
 * @since 0.3
 * @experimental
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.fibChannel demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.fibChannel(
 *                 [
 *                     { time: bar.time, price: bar.low },
 *                     { time: bar.time, price: bar.high },
 *                     { time: bar.time, price: bar.close },
 *                 ],
 *                 { showLabels: true },
 *             );
 *         },
 *     });
 */
export function fibChannel(
    anchors: AnchorTriple,
    opts?: FibOpts,
): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof fibChannel = fibChannel;
 *     // void fn;
 */
export function fibChannel(
    slotId: string,
    anchors: AnchorTriple,
    opts?: FibOpts,
): DrawingHandle;
/**
 * Implementation signature for {@link fibChannel}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const fn: typeof fibChannel = fibChannel;
 *     // void fn;
 */
export function fibChannel(
    arg1: string | AnchorTriple,
    arg2?: AnchorTriple | FibOpts,
    arg3?: FibOpts,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return fibChannelImpl(arg1, arg2 as AnchorTriple, arg3 ?? {});
}
