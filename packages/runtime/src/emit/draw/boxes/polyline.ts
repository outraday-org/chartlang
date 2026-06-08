// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (PolylineDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/polyline-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    DrawingHandle,
    LineDrawStyle,
    PolylineState,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.polyline called outside an active script step";

function polylineImpl(
    slotId: string,
    anchors: ReadonlyArray<WorldPoint>,
    opts: LineDrawStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: PolylineState = { kind: "polyline", anchors, style: opts };
    return createDrawingHandle(slotId, subId, "polyline", state);
}

/**
 * Draw a closed polyline through N world anchors. The renderer
 * auto-connects the last anchor back to the first to close the
 * polygon; supply between 3 and 20 anchors (validator pins this
 * range, mirroring the invinite tool's 20-point cap). The open
 * polyline equivalent will ship as `draw.path` (Task 7).
 *
 * @anchors `anchors` — `ReadonlyArray<WorldPoint>` of length 3..20
 * @anchorCount 3..20
 * @bucket polylines
 * @since 0.3
 * @experimental
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.polyline demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.polyline(
 *                 [
 *                     { time: bar.time, price: bar.low },
 *                     { time: bar.time, price: bar.open },
 *                     { time: bar.time, price: bar.high },
 *                 ],
 *                 { color: "#a855f7", lineWidth: 2 },
 *             );
 *         },
 *     });
 */
export function polyline(anchors: ReadonlyArray<WorldPoint>, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof polyline = polyline;
 *     // void fn;
 */
export function polyline(
    slotId: string,
    anchors: ReadonlyArray<WorldPoint>,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link polyline}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const fn: typeof polyline = polyline;
 *     // void fn;
 */
export function polyline(
    arg1: string | ReadonlyArray<WorldPoint>,
    arg2?: ReadonlyArray<WorldPoint> | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return polylineImpl(arg1, arg2 as ReadonlyArray<WorldPoint>, arg3 ?? {});
}
