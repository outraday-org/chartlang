// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (ArrowMarkUpDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/arrow-mark-up-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    ArrowMarkUpState,
    ArrowMarkerOpts,
    DrawingHandle,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.arrowMarkUp called outside an active script step";

function arrowMarkUpImpl(
    slotId: string,
    anchor: WorldPoint,
    opts: ArrowMarkerOpts,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: ArrowMarkUpState = { kind: "arrow-mark-up", anchor, style: opts };
    return createDrawingHandle(slotId, subId, "arrow-mark-up", state);
}

/**
 * Draw a bullish up-chevron glyph at a single world anchor. The
 * canvas2d renderer paints a filled triangle pointing up; the default
 * fill colour is `"#22c55e"` (green) when `style.color` is omitted.
 * Pine equivalent: `plotshape(condition, style=shape.triangleup)`.
 * Mirrors invinite's `arrow-mark-up-tool.ts` shape.
 *
 * @anchors `anchor` — single `WorldPoint`
 * @anchorCount 1
 * @bucket labels
 * @since 0.3
 * @experimental
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.arrowMarkUp demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.arrowMarkUp({ time: bar.time, price: bar.low });
 *         },
 *     });
 */
export function arrowMarkUp(anchor: WorldPoint, opts?: ArrowMarkerOpts): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof arrowMarkUp = arrowMarkUp;
 *     // void fn;
 */
export function arrowMarkUp(
    slotId: string,
    anchor: WorldPoint,
    opts?: ArrowMarkerOpts,
): DrawingHandle;
/**
 * Implementation signature for {@link arrowMarkUp}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const fn: typeof arrowMarkUp = arrowMarkUp;
 *     // void fn;
 */
export function arrowMarkUp(
    arg1: string | WorldPoint,
    arg2?: WorldPoint | ArrowMarkerOpts,
    arg3?: ArrowMarkerOpts,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return arrowMarkUpImpl(arg1, arg2 as WorldPoint, arg3 ?? {});
}
