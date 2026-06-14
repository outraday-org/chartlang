// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (HighlighterDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/highlighter-tool.ts.
// Re-licensed MIT for chartlang.

import type {
    DrawingHandle,
    HighlighterState,
    HighlighterStyle,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.highlighter called outside an active script step";

function highlighterImpl(
    slotId: string,
    anchors: ReadonlyArray<WorldPoint>,
    opts: HighlighterStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: HighlighterState = { kind: "highlighter", anchors, style: opts };
    return createDrawingHandle(slotId, subId, "highlighter", state);
}

/**
 * Draw a freehand highlighter stroke — a thick translucent polyline
 * through N world anchors. Renders with `ctx.globalAlpha = style.alpha`
 * wrapped around the stroke so the rest of the frame is unaffected.
 * Supply 2..500 anchors (validator pins this range, matching
 * invinite's stroke cap). Both `style.color` and `style.alpha` are
 * required. Mirrors invinite's `highlighter-tool.ts` shape.
 *
 * @anchors `anchors` — `ReadonlyArray<WorldPoint>` of length 2..500
 * @anchorCount 2..500
 * @bucket polylines
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.highlighter demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.highlighter(
 *                 [
 *                     { time: bar.time, price: bar.high },
 *                     { time: bar.time, price: bar.low },
 *                 ],
 *                 { color: "#facc15", alpha: 0.3 },
 *             );
 *         },
 *     });
 */
export function highlighter(
    anchors: ReadonlyArray<WorldPoint>,
    opts: HighlighterStyle,
): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof highlighter = highlighter;
 *     // void fn;
 */
export function highlighter(
    slotId: string,
    anchors: ReadonlyArray<WorldPoint>,
    opts: HighlighterStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link highlighter}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof highlighter = highlighter;
 *     // void fn;
 */
export function highlighter(
    arg1: string | ReadonlyArray<WorldPoint>,
    arg2?: ReadonlyArray<WorldPoint> | HighlighterStyle,
    arg3?: HighlighterStyle,
): DrawingHandle {
    if (
        typeof arg1 !== "string" ||
        arg2 === undefined ||
        !Array.isArray(arg2) ||
        arg3 === undefined
    ) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return highlighterImpl(arg1, arg2 as ReadonlyArray<WorldPoint>, arg3);
}
