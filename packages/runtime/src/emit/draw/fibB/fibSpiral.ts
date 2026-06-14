// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (FibSpiralDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/fib-spiral-tool.ts.
// Re-licensed MIT for chartlang.

import type {
    DrawingHandle,
    FibOpts,
    FibSpiralState,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.fibSpiral called outside an active script step";

function fibSpiralImpl(slotId: string, a: WorldPoint, b: WorldPoint, opts: FibOpts): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: FibSpiralState = {
        kind: "fib-spiral",
        anchors: [a, b],
        style: opts,
    };
    return createDrawingHandle(slotId, subId, "fib-spiral", state);
}

/**
 * Draw a Fibonacci (golden) spiral approximated by chained cubic
 * Beziers, one per quarter-turn. The spiral starts at `a` (centre) with
 * initial radius `|b - a|` and scales by φ ≈ 1.618 per quarter-turn.
 * Mirrors invinite's `fib-spiral-tool.ts` shape. The `counterClockwise`
 * flag from the invinite tool is deferred; the
 * landed renderer is clockwise-only.
 *
 * @anchors `a`, `b` — two `WorldPoint`s (centre, initial-radius edge)
 * @anchorCount 2
 * @bucket other
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.fibSpiral demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.fibSpiral(
 *                 { time: bar.time, price: bar.close },
 *                 { time: bar.time + 30_000, price: bar.high },
 *             );
 *         },
 *     });
 */
export function fibSpiral(a: WorldPoint, b: WorldPoint, opts?: FibOpts): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof fibSpiral = fibSpiral;
 *     // void fn;
 */
export function fibSpiral(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts?: FibOpts,
): DrawingHandle;
/**
 * Implementation signature for {@link fibSpiral}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof fibSpiral = fibSpiral;
 *     // void fn;
 */
export function fibSpiral(
    arg1: string | WorldPoint,
    arg2?: WorldPoint,
    arg3?: WorldPoint | FibOpts,
    arg4?: FibOpts,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || arg3 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return fibSpiralImpl(arg1, arg2, arg3 as WorldPoint, arg4 ?? {});
}
