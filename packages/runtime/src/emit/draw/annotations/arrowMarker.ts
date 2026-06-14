// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (ArrowMarkerDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/arrow-marker-tool.ts.
// Re-licensed MIT for chartlang.

import type {
    ArrowMarkerOpts,
    ArrowMarkerState,
    DrawingHandle,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.arrowMarker called outside an active script step";

function arrowMarkerImpl(slotId: string, anchor: WorldPoint, opts: ArrowMarkerOpts): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: ArrowMarkerState = { kind: "arrow-marker", anchor, style: opts };
    return createDrawingHandle(slotId, subId, "arrow-marker", state);
}

/**
 * Draw a compact arrow-marker glyph at a single world anchor. The
 * canvas2d renderer paints a small filled dot at the anchor, a short
 * stub line, and an arrowhead — a self-contained "annotation lives
 * here" marker. Optional `style.text` paints next to the dot. Default
 * color is `"#3b82f6"` (invinite toolbar blue). Mirrors invinite's
 * `arrow-marker-tool.ts` shape.
 *
 * @anchors `anchor` — single `WorldPoint`
 * @anchorCount 1
 * @bucket labels
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.arrowMarker demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.arrowMarker(
 *                 { time: bar.time, price: bar.close },
 *                 { color: "#10b981", text: "Long" },
 *             );
 *         },
 *     });
 */
export function arrowMarker(anchor: WorldPoint, opts?: ArrowMarkerOpts): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof arrowMarker = arrowMarker;
 *     // void fn;
 */
export function arrowMarker(
    slotId: string,
    anchor: WorldPoint,
    opts?: ArrowMarkerOpts,
): DrawingHandle;
/**
 * Implementation signature for {@link arrowMarker}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof arrowMarker = arrowMarker;
 *     // void fn;
 */
export function arrowMarker(
    arg1: string | WorldPoint,
    arg2?: WorldPoint | ArrowMarkerOpts,
    arg3?: ArrowMarkerOpts,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return arrowMarkerImpl(arg1, arg2 as WorldPoint, arg3 ?? {});
}
