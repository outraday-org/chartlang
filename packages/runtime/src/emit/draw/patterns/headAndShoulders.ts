// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (HeadAndShouldersDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/head-and-shoulders-tool.ts.
// Note: invinite's full schema carries 7 anchors (start, leftShoulder,
// leftTrough, head, rightTrough, rightShoulder, end). The landed Task-1
// `HeadAndShouldersState.anchors: AnchorQuint` is a 5-anchor shell
// (leftShoulder, leftLow, head, rightLow, rightShoulder) — start/end
// projection is flagged as a Task-1 reshape follow-up.
// Re-licensed MIT for chartlang.

import type {
    AnchorQuint,
    DrawingHandle,
    HeadAndShouldersState,
    LineDrawStyle,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.headAndShoulders called outside an active script step";

function headAndShouldersImpl(
    slotId: string,
    anchors: AnchorQuint,
    opts: LineDrawStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: HeadAndShouldersState = {
        kind: "head-and-shoulders",
        anchors,
        style: opts,
    };
    return createDrawingHandle(slotId, subId, "head-and-shoulders", state);
}

/**
 * Draw a head-and-shoulders reversal pattern through 5 world anchors
 * `[leftShoulder, leftLow, head, rightLow, rightShoulder]`. The
 * renderer strokes the connecting polyline plus the neckline between
 * the two trough anchors. Mirrors invinite's
 * `head-and-shoulders-tool.ts` shape.
 *
 * @anchors `anchors` — `[leftShoulder, leftLow, head, rightLow, rightShoulder]`
 * @anchorCount 5
 * @bucket polylines
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.headAndShoulders demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.headAndShoulders([
 *                 { time: bar.time, price: bar.high },
 *                 { time: bar.time + 15_000, price: bar.low },
 *                 { time: bar.time + 30_000, price: bar.high + 1 },
 *                 { time: bar.time + 45_000, price: bar.low },
 *                 { time: bar.time + 60_000, price: bar.high },
 *             ]);
 *         },
 *     });
 */
export function headAndShoulders(anchors: AnchorQuint, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof headAndShoulders = headAndShoulders;
 *     // void fn;
 */
export function headAndShoulders(
    slotId: string,
    anchors: AnchorQuint,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link headAndShoulders}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof headAndShoulders = headAndShoulders;
 *     // void fn;
 */
export function headAndShoulders(
    arg1: string | AnchorQuint,
    arg2?: AnchorQuint | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return headAndShouldersImpl(arg1, arg2 as AnchorQuint, arg3 ?? {});
}
