// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (DoubleCurveDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/double-curve-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    AnchorQuint,
    DoubleCurveState,
    DrawingHandle,
    LineDrawStyle,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.doubleCurve called outside an active script step";

function doubleCurveImpl(slotId: string, anchors: AnchorQuint, opts: LineDrawStyle): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: DoubleCurveState = { kind: "double-curve", anchors, style: opts };
    return createDrawingHandle(slotId, subId, "double-curve", state);
}

/**
 * Draw a cubic Bezier curve through five world anchors `[P0, P1, mid,
 * P3, P4]`. The renderer paints a single cubic from `P0` to `P4` with
 * off-curve controls `P1` and `P3`; the middle anchor `mid` is the
 * stitch point for future split-rendering and is currently preserved
 * but unused at paint time. Mirrors invinite's `double-curve-tool.ts`
 * persisted shape.
 *
 * @anchors `anchors` — `[P0, P1, mid, P3, P4]` quint
 * @anchorCount 5
 * @bucket polylines
 * @since 0.3
 * @experimental
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.doubleCurve demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.doubleCurve(
 *                 [
 *                     { time: bar.time, price: bar.open },
 *                     { time: bar.time, price: bar.high },
 *                     { time: bar.time, price: (bar.high + bar.low) / 2 },
 *                     { time: bar.time, price: bar.low },
 *                     { time: bar.time, price: bar.close },
 *                 ],
 *                 { color: "#a855f7", lineWidth: 2 },
 *             );
 *         },
 *     });
 */
export function doubleCurve(anchors: AnchorQuint, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof doubleCurve = doubleCurve;
 *     // void fn;
 */
export function doubleCurve(
    slotId: string,
    anchors: AnchorQuint,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link doubleCurve}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const fn: typeof doubleCurve = doubleCurve;
 *     // void fn;
 */
export function doubleCurve(
    arg1: string | AnchorQuint,
    arg2?: AnchorQuint | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return doubleCurveImpl(arg1, arg2 as AnchorQuint, arg3 ?? {});
}
