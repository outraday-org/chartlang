// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (XabcdPatternDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/xabcd-pattern-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    AnchorQuint,
    DrawingHandle,
    LineDrawStyle,
    XabcdPatternState,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.xabcdPattern called outside an active script step";

function xabcdPatternImpl(
    slotId: string,
    anchors: AnchorQuint,
    opts: LineDrawStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: XabcdPatternState = { kind: "xabcd-pattern", anchors, style: opts };
    return createDrawingHandle(slotId, subId, "xabcd-pattern", state);
}

/**
 * Draw an XABCD harmonic pattern through 5 world anchors `[X, A, B, C,
 * D]`. The renderer strokes the connecting legs (X-A, A-B, B-C, C-D)
 * and labels each pivot. Mirrors invinite's `xabcd-pattern-tool.ts`
 * shape.
 *
 * @anchors `anchors` — `[X, A, B, C, D]` quint of world points
 * @anchorCount 5
 * @bucket polylines
 * @since 0.3
 * @experimental
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.xabcdPattern demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.xabcdPattern([
 *                 { time: bar.time, price: bar.low },
 *                 { time: bar.time + 15_000, price: bar.high },
 *                 { time: bar.time + 30_000, price: bar.close },
 *                 { time: bar.time + 45_000, price: bar.high - 1 },
 *                 { time: bar.time + 60_000, price: bar.low + 1 },
 *             ]);
 *         },
 *     });
 */
export function xabcdPattern(anchors: AnchorQuint, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof xabcdPattern = xabcdPattern;
 *     // void fn;
 */
export function xabcdPattern(
    slotId: string,
    anchors: AnchorQuint,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link xabcdPattern}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const fn: typeof xabcdPattern = xabcdPattern;
 *     // void fn;
 */
export function xabcdPattern(
    arg1: string | AnchorQuint,
    arg2?: AnchorQuint | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return xabcdPatternImpl(arg1, arg2 as AnchorQuint, arg3 ?? {});
}
