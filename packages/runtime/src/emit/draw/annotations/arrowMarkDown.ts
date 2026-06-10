// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (ArrowMarkDownDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/arrow-mark-down-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    ArrowMarkDownState,
    ArrowMarkerOpts,
    DrawingHandle,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.arrowMarkDown called outside an active script step";

function arrowMarkDownImpl(
    slotId: string,
    anchor: WorldPoint,
    opts: ArrowMarkerOpts,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: ArrowMarkDownState = { kind: "arrow-mark-down", anchor, style: opts };
    return createDrawingHandle(slotId, subId, "arrow-mark-down", state);
}

/**
 * Draw a bearish down-chevron glyph at a single world anchor. The
 * canvas2d renderer paints a filled triangle pointing down; the default
 * fill colour is `"#ef4444"` (red) when `style.color` is omitted. Pine
 * equivalent: `plotshape(condition, style=shape.triangledown)`. Mirrors
 * invinite's `arrow-mark-down-tool.ts` shape.
 *
 * @anchors `anchor` — single `WorldPoint`
 * @anchorCount 1
 * @bucket labels
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.arrowMarkDown demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.arrowMarkDown({ time: bar.time, price: bar.high });
 *         },
 *     });
 */
export function arrowMarkDown(anchor: WorldPoint, opts?: ArrowMarkerOpts): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof arrowMarkDown = arrowMarkDown;
 *     // void fn;
 */
export function arrowMarkDown(
    slotId: string,
    anchor: WorldPoint,
    opts?: ArrowMarkerOpts,
): DrawingHandle;
/**
 * Implementation signature for {@link arrowMarkDown}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof arrowMarkDown = arrowMarkDown;
 *     // void fn;
 */
export function arrowMarkDown(
    arg1: string | WorldPoint,
    arg2?: WorldPoint | ArrowMarkerOpts,
    arg3?: ArrowMarkerOpts,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return arrowMarkDownImpl(arg1, arg2 as WorldPoint, arg3 ?? {});
}
