// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (MarkerDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/marker-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    DrawingHandle,
    MarkerState,
    TextOpts,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.marker called outside an active script step";

type MarkerOpts = TextOpts & {
    readonly text?: string;
    readonly value?: number;
};

function markerImpl(slotId: string, anchor: WorldPoint, opts: MarkerOpts): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    // Split the merged opts bag: top-level `text` / `value` live on the
    // state; the remaining TextOpts fields nest under `style`.
    const { text, value, ...style } = opts;
    const state: MarkerState = {
        kind: "marker",
        anchor,
        ...(text !== undefined ? { text } : {}),
        ...(value !== undefined ? { value } : {}),
        style,
    };
    return createDrawingHandle(slotId, subId, "marker", state);
}

/**
 * Draw a single-anchor marker glyph with an optional text label and
 * numeric value. The renderer projects `anchor` to canvas pixel space
 * and paints the `text` (if any) at that position using the
 * {@link TextOpts}-derived font + alignment.
 *
 * @anchors `anchor` — one `WorldPoint`
 * @anchorCount 1
 * @bucket labels
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.marker demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.marker(
 *                 { time: bar.time, price: bar.close },
 *                 { text: "B", size: "large", color: "#10b981" },
 *             );
 *         },
 *     });
 */
export function marker(anchor: WorldPoint, opts?: MarkerOpts): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof marker = marker;
 *     // void fn;
 */
export function marker(slotId: string, anchor: WorldPoint, opts?: MarkerOpts): DrawingHandle;
/**
 * Implementation signature for {@link marker}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof marker = marker;
 *     // void fn;
 */
export function marker(
    arg1: string | WorldPoint,
    arg2?: WorldPoint | MarkerOpts,
    arg3?: MarkerOpts,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return markerImpl(arg1, arg2 as WorldPoint, arg3 ?? {});
}
