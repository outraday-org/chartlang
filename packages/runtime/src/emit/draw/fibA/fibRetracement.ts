// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (FibRetracementDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/fib-retracement-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    DrawingHandle,
    FibOpts,
    FibRetracementState,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.fibRetracement called outside an active script step";

function fibRetracementImpl(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts: FibOpts,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: FibRetracementState = {
        kind: "fib-retracement",
        anchors: [a, b],
        style: opts,
    };
    return createDrawingHandle(slotId, subId, "fib-retracement", state);
}

/**
 * Draw a Fibonacci retracement between two swing-pivot world anchors.
 * Levels default to the canonical `FIB_LEVELS` array when
 * `opts.levels` is omitted; the renderer paints one horizontal line
 * per level between `a.price` and `b.price`. Mirrors invinite's
 * `fib-retracement-tool.ts` shape.
 *
 * @anchors `a`, `b` — two swing `WorldPoint`s
 * @anchorCount 2
 * @bucket other
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.fibRetracement demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.fibRetracement(
 *                 { time: bar.time, price: bar.low },
 *                 { time: bar.time, price: bar.high },
 *                 { showLabels: true, extendRight: true },
 *             );
 *         },
 *     });
 */
export function fibRetracement(a: WorldPoint, b: WorldPoint, opts?: FibOpts): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof fibRetracement = fibRetracement;
 *     // void fn;
 */
export function fibRetracement(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts?: FibOpts,
): DrawingHandle;
/**
 * Implementation signature for {@link fibRetracement}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof fibRetracement = fibRetracement;
 *     // void fn;
 */
export function fibRetracement(
    arg1: string | WorldPoint,
    arg2?: WorldPoint,
    arg3?: WorldPoint | FibOpts,
    arg4?: FibOpts,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || arg3 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return fibRetracementImpl(arg1, arg2, arg3 as WorldPoint, arg4 ?? {});
}
