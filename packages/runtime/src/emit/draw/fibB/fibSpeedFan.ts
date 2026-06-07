// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (FibSpeedFanDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/fib-speed-fan-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    DrawingHandle,
    FibOpts,
    FibSpeedFanState,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.fibSpeedFan called outside an active script step";

function fibSpeedFanImpl(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts: FibOpts,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: FibSpeedFanState = {
        kind: "fib-speed-fan",
        anchors: [a, b],
        style: opts,
    };
    return createDrawingHandle(slotId, subId, "fib-speed-fan", state);
}

/**
 * Draw a Fibonacci speed-fan — a fan of rays from `a` whose slopes are
 * fib-ratio scalings of the (a→b) slope. Levels default to the
 * canonical `FIB_LEVELS` array when `opts.levels` is omitted. Mirrors
 * invinite's `fib-speed-fan-tool.ts` shape.
 *
 * @anchors `a`, `b` — two `WorldPoint`s (pivot, reference)
 * @anchorCount 2
 * @bucket other
 * @since 0.3
 * @experimental
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.fibSpeedFan demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.fibSpeedFan(
 *                 { time: bar.time, price: bar.low },
 *                 { time: bar.time + 30_000, price: bar.high },
 *                 { showLabels: true },
 *             );
 *         },
 *     });
 */
export function fibSpeedFan(
    a: WorldPoint,
    b: WorldPoint,
    opts?: FibOpts,
): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof fibSpeedFan = fibSpeedFan;
 *     // void fn;
 */
export function fibSpeedFan(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts?: FibOpts,
): DrawingHandle;
/**
 * Implementation signature for {@link fibSpeedFan}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const fn: typeof fibSpeedFan = fibSpeedFan;
 *     // void fn;
 */
export function fibSpeedFan(
    arg1: string | WorldPoint,
    arg2?: WorldPoint,
    arg3?: WorldPoint | FibOpts,
    arg4?: FibOpts,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || arg3 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return fibSpeedFanImpl(arg1, arg2, arg3 as WorldPoint, arg4 ?? {});
}
