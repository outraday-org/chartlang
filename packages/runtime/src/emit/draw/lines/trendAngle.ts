// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (TrendAngleDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/trend-angle-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    DrawingHandle,
    LineDrawStyle,
    TrendAngleState,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.trendAngle called outside an active script step";

function trendAngleImpl(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts: LineDrawStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: TrendAngleState = { kind: "trend-angle", anchors: [a, b], style: opts };
    return createDrawingHandle(slotId, subId, "trend-angle", state);
}

/**
 * Draw a line between two anchors plus a small arc + angle label at
 * the `a` anchor. The angle is the screen-space slope between `a`
 * and `b`, formatted as `${value.toFixed(1)}°`.
 *
 * @anchors `a`, `b` — two `WorldPoint`s
 * @anchorCount 2
 * @bucket lines
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.trendAngle demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.trendAngle(
 *                 { time: bar.time, price: bar.low },
 *                 { time: bar.time, price: bar.high },
 *                 { color: "#22c55e" },
 *             );
 *         },
 *     });
 */
export function trendAngle(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof trendAngle = trendAngle;
 *     // void fn;
 */
export function trendAngle(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link trendAngle}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof trendAngle = trendAngle;
 *     // void fn;
 */
export function trendAngle(
    arg1: string | WorldPoint,
    arg2?: WorldPoint,
    arg3?: WorldPoint | LineDrawStyle,
    arg4?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || arg3 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return trendAngleImpl(arg1, arg2, arg3 as WorldPoint, arg4 ?? {});
}
