// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (FibCirclesDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/fib-circles-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    DrawingHandle,
    FibCirclesState,
    FibOpts,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.fibCircles called outside an active script step";

function fibCirclesImpl(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts: FibOpts,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: FibCirclesState = {
        kind: "fib-circles",
        anchors: [a, b],
        style: opts,
    };
    return createDrawingHandle(slotId, subId, "fib-circles", state);
}

/**
 * Draw concentric Fibonacci circles centred at `a` (the centre) passing
 * through fib-ratio multiples of `|b - a|` (the radius-point distance).
 * Mirrors invinite's `fib-circles-tool.ts` shape. Renderer uses
 * `style.levels ?? FIB_LEVELS` (the ratio array, NOT the integer
 * Fibonacci sequence — see Task-1 reshape follow-up in
 * `tasks/phase-3-drawing-parity/12-fibonacci-b.plan.md` §4).
 *
 * @anchors `a`, `b` — two `WorldPoint`s (centre, radius-point)
 * @anchorCount 2
 * @bucket other
 * @since 0.3
 * @experimental
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.fibCircles demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.fibCircles(
 *                 { time: bar.time, price: bar.close },
 *                 { time: bar.time + 30_000, price: bar.high },
 *                 { showLabels: true },
 *             );
 *         },
 *     });
 */
export function fibCircles(a: WorldPoint, b: WorldPoint, opts?: FibOpts): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof fibCircles = fibCircles;
 *     // void fn;
 */
export function fibCircles(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts?: FibOpts,
): DrawingHandle;
/**
 * Implementation signature for {@link fibCircles}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const fn: typeof fibCircles = fibCircles;
 *     // void fn;
 */
export function fibCircles(
    arg1: string | WorldPoint,
    arg2?: WorldPoint,
    arg3?: WorldPoint | FibOpts,
    arg4?: FibOpts,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || arg3 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return fibCirclesImpl(arg1, arg2, arg3 as WorldPoint, arg4 ?? {});
}
