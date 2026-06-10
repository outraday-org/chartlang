// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (FibSpeedArcsDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/fib-speed-arcs-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    DrawingHandle,
    FibOpts,
    FibSpeedArcsState,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.fibSpeedArcs called outside an active script step";

function fibSpeedArcsImpl(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts: FibOpts,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: FibSpeedArcsState = {
        kind: "fib-speed-arcs",
        anchors: [a, b],
        style: opts,
    };
    return createDrawingHandle(slotId, subId, "fib-speed-arcs", state);
}

/**
 * Draw a set of Fibonacci speed-arcs — concentric circular arcs centred
 * at `a` with radii `level * |b - a|` for each `level` in
 * `opts.levels ?? FIB_LEVELS`. Mirrors invinite's
 * `fib-speed-arcs-tool.ts` shape.
 *
 * @anchors `a`, `b` — two `WorldPoint`s (centre, edge)
 * @anchorCount 2
 * @bucket other
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.fibSpeedArcs demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.fibSpeedArcs(
 *                 { time: bar.time, price: bar.close },
 *                 { time: bar.time + 30_000, price: bar.high },
 *                 { showLabels: true },
 *             );
 *         },
 *     });
 */
export function fibSpeedArcs(a: WorldPoint, b: WorldPoint, opts?: FibOpts): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof fibSpeedArcs = fibSpeedArcs;
 *     // void fn;
 */
export function fibSpeedArcs(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts?: FibOpts,
): DrawingHandle;
/**
 * Implementation signature for {@link fibSpeedArcs}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof fibSpeedArcs = fibSpeedArcs;
 *     // void fn;
 */
export function fibSpeedArcs(
    arg1: string | WorldPoint,
    arg2?: WorldPoint,
    arg3?: WorldPoint | FibOpts,
    arg4?: FibOpts,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || arg3 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return fibSpeedArcsImpl(arg1, arg2, arg3 as WorldPoint, arg4 ?? {});
}
