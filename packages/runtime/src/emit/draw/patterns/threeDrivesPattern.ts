// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (ThreeDrivesPatternDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/three-drives-pattern-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    AnchorHept,
    DrawingHandle,
    LineDrawStyle,
    ThreeDrivesPatternState,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.threeDrivesPattern called outside an active script step";

function threeDrivesPatternImpl(
    slotId: string,
    anchors: AnchorHept,
    opts: LineDrawStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: ThreeDrivesPatternState = {
        kind: "three-drives-pattern",
        anchors,
        style: opts,
    };
    return createDrawingHandle(slotId, subId, "three-drives-pattern", state);
}

/**
 * Draw a three-drives reversal pattern through 7 world anchors
 * `[start, drive1, retr1, drive2, retr2, drive3, end]`. The renderer
 * strokes the 6-leg open polyline and labels each pivot. Mirrors
 * invinite's `three-drives-pattern-tool.ts` shape.
 *
 * @anchors `anchors` — `[start, drive1, retr1, drive2, retr2, drive3, end]`
 * @anchorCount 7
 * @bucket polylines
 * @since 0.3
 * @experimental
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.threeDrivesPattern demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.threeDrivesPattern([
 *                 { time: bar.time, price: bar.low },
 *                 { time: bar.time + 10_000, price: bar.high },
 *                 { time: bar.time + 20_000, price: bar.close },
 *                 { time: bar.time + 30_000, price: bar.high + 1 },
 *                 { time: bar.time + 40_000, price: bar.close + 0.5 },
 *                 { time: bar.time + 50_000, price: bar.high + 2 },
 *                 { time: bar.time + 60_000, price: bar.close + 1 },
 *             ]);
 *         },
 *     });
 */
export function threeDrivesPattern(anchors: AnchorHept, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof threeDrivesPattern = threeDrivesPattern;
 *     // void fn;
 */
export function threeDrivesPattern(
    slotId: string,
    anchors: AnchorHept,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link threeDrivesPattern}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const fn: typeof threeDrivesPattern = threeDrivesPattern;
 *     // void fn;
 */
export function threeDrivesPattern(
    arg1: string | AnchorHept,
    arg2?: AnchorHept | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return threeDrivesPatternImpl(arg1, arg2 as AnchorHept, arg3 ?? {});
}
