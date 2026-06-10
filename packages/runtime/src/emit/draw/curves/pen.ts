// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (PenDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/pen-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    DrawingHandle,
    LineDrawStyle,
    PenState,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.pen called outside an active script step";

function penImpl(
    slotId: string,
    anchors: ReadonlyArray<WorldPoint>,
    opts: LineDrawStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: PenState = { kind: "pen", anchors, style: opts };
    return createDrawingHandle(slotId, subId, "pen", state);
}

/**
 * Draw a freehand pen stroke through N world anchors. Renders as an
 * OPEN polyline (mirrors `polyline` but without the auto-close).
 * Supply 2..500 anchors (validator pins this range, matching
 * invinite's stroke cap). Mirrors invinite's `pen-tool.ts` shape.
 *
 * @anchors `anchors` — `ReadonlyArray<WorldPoint>` of length 2..500
 * @anchorCount 2..500
 * @bucket polylines
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.pen demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.pen(
 *                 [
 *                     { time: bar.time, price: bar.open },
 *                     { time: bar.time, price: bar.close },
 *                 ],
 *                 { color: "#1e293b", lineWidth: 2 },
 *             );
 *         },
 *     });
 */
export function pen(anchors: ReadonlyArray<WorldPoint>, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof pen = pen;
 *     // void fn;
 */
export function pen(
    slotId: string,
    anchors: ReadonlyArray<WorldPoint>,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link pen}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof pen = pen;
 *     // void fn;
 */
export function pen(
    arg1: string | ReadonlyArray<WorldPoint>,
    arg2?: ReadonlyArray<WorldPoint> | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return penImpl(arg1, arg2 as ReadonlyArray<WorldPoint>, arg3 ?? {});
}
