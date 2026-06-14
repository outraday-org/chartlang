// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (HorizontalRayDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/horizontal-ray-tool.ts.
// Re-licensed MIT for chartlang.

import type {
    DrawingHandle,
    HorizontalRayState,
    LineDrawStyle,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.horizontalRay called outside an active script step";

function horizontalRayImpl(slotId: string, anchor: WorldPoint, opts: LineDrawStyle): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: HorizontalRayState = { kind: "horizontal-ray", anchor, style: opts };
    return createDrawingHandle(slotId, subId, "horizontal-ray", state);
}

/**
 * Draw a horizontal ray starting at `anchor` and extending to the
 * right edge of the viewport at constant price.
 *
 * @anchors `anchor` — one `WorldPoint`
 * @anchorCount 1
 * @bucket lines
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.horizontalRay demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.horizontalRay(
 *                 { time: bar.time, price: bar.close },
 *                 { color: "#10b981" },
 *             );
 *         },
 *     });
 */
export function horizontalRay(anchor: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof horizontalRay = horizontalRay;
 *     // void fn;
 */
export function horizontalRay(
    slotId: string,
    anchor: WorldPoint,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link horizontalRay}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof horizontalRay = horizontalRay;
 *     // void fn;
 */
export function horizontalRay(
    arg1: string | WorldPoint,
    arg2?: WorldPoint | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || typeof arg2 !== "object") {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return horizontalRayImpl(arg1, arg2 as WorldPoint, arg3 ?? {});
}
