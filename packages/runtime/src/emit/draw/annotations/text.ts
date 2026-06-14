// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (TextDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/text-tool.ts.
// Re-licensed MIT for chartlang.

import type { DrawingHandle, TextOpts, TextState, WorldPoint } from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.text called outside an active script step";

function textImpl(slotId: string, anchor: WorldPoint, body: string, opts: TextOpts): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: TextState = { kind: "text", anchor, body, style: opts };
    return createDrawingHandle(slotId, subId, "text", state);
}

/**
 * Draw a freeform text annotation anchored at a single world point.
 * The `body` string surfaces in the rendered glyph; the validator pins
 * it as a non-empty string of length ≤ 256 (longer than the 128 cap on
 * plot labels — annotation strings carry short rationales like
 * "Inverse Head and Shoulders Confirmed"). Mirrors invinite's
 * `text-tool.ts` shape.
 *
 * @anchors `anchor` — single `WorldPoint`
 * @anchorCount 1
 * @bucket labels
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.text demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.text(
 *                 { time: bar.time, price: bar.high },
 *                 "Peak",
 *                 { color: "#1e293b", size: "normal" },
 *             );
 *         },
 *     });
 */
export function text(anchor: WorldPoint, body: string, opts?: TextOpts): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof text = text;
 *     // void fn;
 */
export function text(
    slotId: string,
    anchor: WorldPoint,
    body: string,
    opts?: TextOpts,
): DrawingHandle;
/**
 * Implementation signature for {@link text}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload. Unique among Task-9 emit fns in that it
 * carries four arguments (slot id + anchor + body + opts).
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof text = text;
 *     // void fn;
 */
export function text(
    arg1: string | WorldPoint,
    arg2?: WorldPoint | string,
    arg3?: string | TextOpts,
    arg4?: TextOpts,
): DrawingHandle {
    if (
        typeof arg1 !== "string" ||
        arg2 === undefined ||
        typeof arg2 === "string" ||
        typeof arg3 !== "string"
    ) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return textImpl(arg1, arg2, arg3, arg4 ?? {});
}
