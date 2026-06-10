// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (FibTrendTimeDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/fib-trend-time-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    AnchorTriple,
    DrawingHandle,
    FibOpts,
    FibTrendTimeState,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.fibTrendTime called outside an active script step";

function fibTrendTimeImpl(slotId: string, anchors: AnchorTriple, opts: FibOpts): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: FibTrendTimeState = {
        kind: "fib-trend-time",
        anchors,
        style: opts,
    };
    return createDrawingHandle(slotId, subId, "fib-trend-time", state);
}

/**
 * Draw fib-spaced vertical time projections from a swing leg. For each
 * `level` in `opts.levels ?? FIB_LEVELS`, paints a vertical line at
 * `t = anchors[2].time + level * (anchors[1].time - anchors[0].time)`.
 * Mirrors invinite's `fib-trend-time-tool.ts` shape using the ratio
 * array (see Task-1 reshape follow-up in
 * `tasks/phase-3-drawing-parity/12-fibonacci-b.plan.md` §8).
 *
 * @anchors `anchors` — `[A, B, C]` triple (A→B leg defines the time
 *   delta; C is the projection origin)
 * @anchorCount 3
 * @bucket other
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.fibTrendTime demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.fibTrendTime(
 *                 [
 *                     { time: bar.time, price: bar.low },
 *                     { time: bar.time + 30_000, price: bar.high },
 *                     { time: bar.time + 60_000, price: bar.close },
 *                 ],
 *                 { showLabels: true },
 *             );
 *         },
 *     });
 */
export function fibTrendTime(anchors: AnchorTriple, opts?: FibOpts): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof fibTrendTime = fibTrendTime;
 *     // void fn;
 */
export function fibTrendTime(slotId: string, anchors: AnchorTriple, opts?: FibOpts): DrawingHandle;
/**
 * Implementation signature for {@link fibTrendTime}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof fibTrendTime = fibTrendTime;
 *     // void fn;
 */
export function fibTrendTime(
    arg1: string | AnchorTriple,
    arg2?: AnchorTriple | FibOpts,
    arg3?: FibOpts,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return fibTrendTimeImpl(arg1, arg2 as AnchorTriple, arg3 ?? {});
}
