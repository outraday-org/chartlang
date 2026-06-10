// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (FibWedgeDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/fib-wedge-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    AnchorTriple,
    DrawingHandle,
    FibOpts,
    FibWedgeState,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.fibWedge called outside an active script step";

function fibWedgeImpl(slotId: string, anchors: AnchorTriple, opts: FibOpts): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: FibWedgeState = { kind: "fib-wedge", anchors, style: opts };
    return createDrawingHandle(slotId, subId, "fib-wedge", state);
}

/**
 * Draw a Fibonacci wedge — rays fanning from `anchors[0]` (the pivot)
 * at fib-ratio interpolated angles between the (pivot→`anchors[1]`)
 * and (pivot→`anchors[2]`) directions. Mirrors invinite's
 * `fib-wedge-tool.ts` shape.
 *
 * @anchors `anchors` — `[pivot, range1, range2]` triple
 * @anchorCount 3
 * @bucket other
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.fibWedge demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.fibWedge(
 *                 [
 *                     { time: bar.time, price: bar.close },
 *                     { time: bar.time + 30_000, price: bar.high },
 *                     { time: bar.time + 30_000, price: bar.low },
 *                 ],
 *                 { showLabels: true },
 *             );
 *         },
 *     });
 */
export function fibWedge(anchors: AnchorTriple, opts?: FibOpts): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof fibWedge = fibWedge;
 *     // void fn;
 */
export function fibWedge(slotId: string, anchors: AnchorTriple, opts?: FibOpts): DrawingHandle;
/**
 * Implementation signature for {@link fibWedge}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof fibWedge = fibWedge;
 *     // void fn;
 */
export function fibWedge(
    arg1: string | AnchorTriple,
    arg2?: AnchorTriple | FibOpts,
    arg3?: FibOpts,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return fibWedgeImpl(arg1, arg2 as AnchorTriple, arg3 ?? {});
}
