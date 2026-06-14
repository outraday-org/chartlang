// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (GannBoxDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/gann-box-tool.ts.
// Re-licensed MIT for chartlang.

import type {
    DrawingHandle,
    GannBoxState,
    LineDrawStyle,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.gannBox called outside an active script step";

function gannBoxImpl(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts: LineDrawStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: GannBoxState = {
        kind: "gann-box",
        anchors: [a, b],
        style: opts,
    };
    return createDrawingHandle(slotId, subId, "gann-box", state);
}

/**
 * Draw a Gann box — a ratio grid spanning the bounding rectangle of
 * two world anchors. The renderer paints internal horizontal +
 * vertical subdivisions at the shared `GANN_LEVELS` ratios
 * (`[0, 0.25, 0.5, 0.75, 1.0]`). Mirrors invinite's `gann-box-tool.ts`
 * shape.
 *
 * @anchors `a`, `b` — two `WorldPoint`s defining the box corners
 * @anchorCount 2
 * @bucket other
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.gannBox demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.gannBox(
 *                 { time: bar.time, price: bar.low },
 *                 { time: bar.time + 30_000, price: bar.high },
 *             );
 *         },
 *     });
 */
export function gannBox(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof gannBox = gannBox;
 *     // void fn;
 */
export function gannBox(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link gannBox}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof gannBox = gannBox;
 *     // void fn;
 */
export function gannBox(
    arg1: string | WorldPoint,
    arg2?: WorldPoint,
    arg3?: WorldPoint | LineDrawStyle,
    arg4?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || arg3 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return gannBoxImpl(arg1, arg2, arg3 as WorldPoint, arg4 ?? {});
}
