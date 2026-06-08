// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (AbcdPatternDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/abcd-pattern-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    AbcdPatternState,
    AnchorQuad,
    DrawingHandle,
    LineDrawStyle,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.abcdPattern called outside an active script step";

function abcdPatternImpl(slotId: string, anchors: AnchorQuad, opts: LineDrawStyle): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: AbcdPatternState = { kind: "abcd-pattern", anchors, style: opts };
    return createDrawingHandle(slotId, subId, "abcd-pattern", state);
}

/**
 * Draw an ABCD measured-move pattern through 4 world anchors `[A, B,
 * C, D]`. The renderer strokes the connecting legs (A-B, B-C, C-D)
 * and labels each pivot. Mirrors invinite's `abcd-pattern-tool.ts`
 * shape.
 *
 * @anchors `anchors` — `[A, B, C, D]` quad of world points
 * @anchorCount 4
 * @bucket polylines
 * @since 0.3
 * @experimental
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.abcdPattern demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.abcdPattern([
 *                 { time: bar.time, price: bar.low },
 *                 { time: bar.time + 20_000, price: bar.high },
 *                 { time: bar.time + 40_000, price: bar.close },
 *                 { time: bar.time + 60_000, price: bar.high + 1 },
 *             ]);
 *         },
 *     });
 */
export function abcdPattern(anchors: AnchorQuad, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof abcdPattern = abcdPattern;
 *     // void fn;
 */
export function abcdPattern(
    slotId: string,
    anchors: AnchorQuad,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link abcdPattern}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const fn: typeof abcdPattern = abcdPattern;
 *     // void fn;
 */
export function abcdPattern(
    arg1: string | AnchorQuad,
    arg2?: AnchorQuad | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return abcdPatternImpl(arg1, arg2 as AnchorQuad, arg3 ?? {});
}
