// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (BrushDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/brush-tool.ts.
// Re-licensed MIT for chartlang.

import type {
    BrushState,
    BrushStyle,
    DrawingHandle,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.brush called outside an active script step";

function brushImpl(
    slotId: string,
    anchors: ReadonlyArray<WorldPoint>,
    opts: BrushStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: BrushState = { kind: "brush", anchors, style: opts };
    return createDrawingHandle(slotId, subId, "brush", state);
}

/**
 * Draw a freehand brush stroke — a stroked + filled polyline through
 * N world anchors. The renderer treats the polyline as a closed
 * region (`moveTo + N-1 lineTo + closePath`) and paints fill before
 * stroke. Supply 2..500 anchors (validator pins this range, matching
 * invinite's stroke cap). Both `style.stroke` and `style.fill` are
 * required. Mirrors invinite's `brush-tool.ts` shape.
 *
 * @anchors `anchors` — `ReadonlyArray<WorldPoint>` of length 2..500
 * @anchorCount 2..500
 * @bucket polylines
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.brush demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.brush(
 *                 [
 *                     { time: bar.time, price: bar.open },
 *                     { time: bar.time, price: bar.high },
 *                     { time: bar.time, price: bar.close },
 *                 ],
 *                 { stroke: "#000000", fill: "#dbeafe" },
 *             );
 *         },
 *     });
 */
export function brush(anchors: ReadonlyArray<WorldPoint>, opts: BrushStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof brush = brush;
 *     // void fn;
 */
export function brush(
    slotId: string,
    anchors: ReadonlyArray<WorldPoint>,
    opts: BrushStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link brush}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof brush = brush;
 *     // void fn;
 */
export function brush(
    arg1: string | ReadonlyArray<WorldPoint>,
    arg2?: ReadonlyArray<WorldPoint> | BrushStyle,
    arg3?: BrushStyle,
): DrawingHandle {
    if (
        typeof arg1 !== "string" ||
        arg2 === undefined ||
        !Array.isArray(arg2) ||
        arg3 === undefined
    ) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return brushImpl(arg1, arg2 as ReadonlyArray<WorldPoint>, arg3);
}
