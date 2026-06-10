// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (GannSquareDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/gann-square-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    DrawingHandle,
    GannSquareState,
    LineDrawStyle,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.gannSquare called outside an active script step";

function gannSquareImpl(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts: LineDrawStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: GannSquareState = {
        kind: "gann-square",
        anchors: [a, b],
        style: opts,
    };
    return createDrawingHandle(slotId, subId, "gann-square", state);
}

/**
 * Draw a Gann square-of-nine sized by two world anchors. The renderer
 * paints a canvas-space square whose side is `max(|dx|, |dy|)` between
 * the anchors, subdivided by `GANN_LEVELS`. Mirrors invinite's
 * `gann-square-tool.ts` shape.
 *
 * @anchors `a`, `b` — two `WorldPoint`s
 * @anchorCount 2
 * @bucket other
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.gannSquare demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.gannSquare(
 *                 { time: bar.time, price: bar.low },
 *                 { time: bar.time + 30_000, price: bar.high },
 *             );
 *         },
 *     });
 */
export function gannSquare(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof gannSquare = gannSquare;
 *     // void fn;
 */
export function gannSquare(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link gannSquare}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof gannSquare = gannSquare;
 *     // void fn;
 */
export function gannSquare(
    arg1: string | WorldPoint,
    arg2?: WorldPoint,
    arg3?: WorldPoint | LineDrawStyle,
    arg4?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || arg3 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return gannSquareImpl(arg1, arg2, arg3 as WorldPoint, arg4 ?? {});
}
