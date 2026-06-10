// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (ArrowDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/arrow-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    ArrowOpts,
    ArrowState,
    DrawingHandle,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.arrow called outside an active script step";

function arrowImpl(slotId: string, a: WorldPoint, b: WorldPoint, opts: ArrowOpts): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: ArrowState = { kind: "arrow", anchors: [a, b], style: opts };
    return createDrawingHandle(slotId, subId, "arrow", state);
}

/**
 * Draw a directional arrow from `a` (tail) to `b` (head) with an
 * optional axis-aligned label centred near the shaft midpoint. The
 * arrowhead at `b` points along the shaft direction. Inherits every
 * {@link import("@invinite-org/chartlang-core").LineDrawStyle} field
 * (color, lineWidth, lineStyle, extendLeft, extendRight) plus the
 * arrow-specific `label?: string`. Mirrors invinite's `arrow-tool.ts`
 * shape.
 *
 * @anchors `a`, `b` — tail and head `WorldPoint`s
 * @anchorCount 2
 * @bucket labels
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.arrow demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.arrow(
 *                 { time: bar.time, price: bar.low },
 *                 { time: bar.time, price: bar.high },
 *                 { color: "#dc2626", lineWidth: 2, label: "Sell" },
 *             );
 *         },
 *     });
 */
export function arrow(a: WorldPoint, b: WorldPoint, opts?: ArrowOpts): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof arrow = arrow;
 *     // void fn;
 */
export function arrow(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts?: ArrowOpts,
): DrawingHandle;
/**
 * Implementation signature for {@link arrow}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof arrow = arrow;
 *     // void fn;
 */
export function arrow(
    arg1: string | WorldPoint,
    arg2?: WorldPoint,
    arg3?: WorldPoint | ArrowOpts,
    arg4?: ArrowOpts,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || arg3 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return arrowImpl(arg1, arg2, arg3 as WorldPoint, arg4 ?? {});
}
