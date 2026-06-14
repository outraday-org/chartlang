// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (TimeCyclesDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/time-cycles-tool.ts.
// Re-licensed MIT for chartlang.

import type {
    DrawingHandle,
    LineDrawStyle,
    TimeCyclesState,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.timeCycles called outside an active script step";

function timeCyclesImpl(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts: LineDrawStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: TimeCyclesState = {
        kind: "time-cycles",
        anchors: [a, b],
        style: opts,
    };
    return createDrawingHandle(slotId, subId, "time-cycles", state);
}

/**
 * Draw concentric semicircles measuring time cycles between two world
 * anchors `[centre, edge]`. The renderer projects upper-half arcs
 * centred at the midpoint of the two anchors at the `from.price`
 * baseline; arcs tile across the viewport at multiples of the arc
 * diameter.
 *
 * @anchors `a`, `b` — two `WorldPoint`s `(from, to)`
 * @anchorCount 2
 * @bucket other
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.timeCycles demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.timeCycles(
 *                 { time: bar.time, price: bar.close },
 *                 { time: bar.time + 60_000, price: bar.close },
 *                 { color: "#0ea5e9" },
 *             );
 *         },
 *     });
 */
export function timeCycles(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof timeCycles = timeCycles;
 *     // void fn;
 */
export function timeCycles(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link timeCycles}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof timeCycles = timeCycles;
 *     // void fn;
 */
export function timeCycles(
    arg1: string | WorldPoint,
    arg2?: WorldPoint,
    arg3?: WorldPoint | LineDrawStyle,
    arg4?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || arg3 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return timeCyclesImpl(arg1, arg2, arg3 as WorldPoint, arg4 ?? {});
}
