// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (GannSquareFixedDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/gann-square-fixed-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    DrawingHandle,
    GannSquareFixedState,
    LineDrawStyle,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.gannSquareFixed called outside an active script step";

function gannSquareFixedImpl(
    slotId: string,
    anchor: WorldPoint,
    opts: LineDrawStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: GannSquareFixedState = {
        kind: "gann-square-fixed",
        anchor,
        style: opts,
    };
    return createDrawingHandle(slotId, subId, "gann-square-fixed", state);
}

/**
 * Draw a Gann square-of-nine with a fixed pixel side anchored at a
 * single world point. The renderer paints a `80×80` pixel square
 * subdivided by `GANN_LEVELS`. Mirrors invinite's
 * `gann-square-fixed-tool.ts` shape.
 *
 * @anchors `anchor` — a single `WorldPoint`
 * @anchorCount 1
 * @bucket other
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.gannSquareFixed demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.gannSquareFixed({ time: bar.time, price: bar.close });
 *         },
 *     });
 */
export function gannSquareFixed(anchor: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof gannSquareFixed = gannSquareFixed;
 *     // void fn;
 */
export function gannSquareFixed(
    slotId: string,
    anchor: WorldPoint,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link gannSquareFixed}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof gannSquareFixed = gannSquareFixed;
 *     // void fn;
 */
export function gannSquareFixed(
    arg1: string | WorldPoint,
    arg2?: WorldPoint | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return gannSquareFixedImpl(arg1, arg2 as WorldPoint, arg3 ?? {});
}
