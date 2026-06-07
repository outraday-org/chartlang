// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (TrianglePatternDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/triangle-pattern-tool.ts.
// Note: invinite's full schema carries 4 anchors (a, b, c, d). The
// landed Task-1 `TrianglePatternState.anchors: AnchorTriple` is a
// 3-anchor shell `[apex, baseHigh, baseLow]` — the 4th anchor is
// flagged as a Task-1 reshape follow-up. The kind is distinct from
// `draw.triangle` (Task 6), a 3-anchor solid-shape primitive — this
// is the 3-anchor harmonic-pattern outline.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    AnchorTriple,
    DrawingHandle,
    LineDrawStyle,
    TrianglePatternState,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.trianglePattern called outside an active script step";

function trianglePatternImpl(
    slotId: string,
    anchors: AnchorTriple,
    opts: LineDrawStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: TrianglePatternState = {
        kind: "triangle-pattern",
        anchors,
        style: opts,
    };
    return createDrawingHandle(slotId, subId, "triangle-pattern", state);
}

/**
 * Draw a triangle pattern (ascending / descending / symmetrical)
 * through 3 world anchors `[apex, baseHigh, baseLow]`. The renderer
 * strokes the 3-vertex closed polygon and labels each pivot.
 * **Distinct from `draw.triangle`** (Task 6, a solid-shape primitive
 * with ShapeStyle); this is the harmonic-pattern outline with
 * LineDrawStyle. Mirrors invinite's `triangle-pattern-tool.ts` shape.
 *
 * @anchors `anchors` — `[apex, baseHigh, baseLow]` triple
 * @anchorCount 3
 * @bucket polylines
 * @since 0.3
 * @experimental
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.trianglePattern demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.trianglePattern([
 *                 { time: bar.time + 60_000, price: bar.close },
 *                 { time: bar.time, price: bar.high },
 *                 { time: bar.time, price: bar.low },
 *             ]);
 *         },
 *     });
 */
export function trianglePattern(
    anchors: AnchorTriple,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof trianglePattern = trianglePattern;
 *     // void fn;
 */
export function trianglePattern(
    slotId: string,
    anchors: AnchorTriple,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link trianglePattern}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const fn: typeof trianglePattern = trianglePattern;
 *     // void fn;
 */
export function trianglePattern(
    arg1: string | AnchorTriple,
    arg2?: AnchorTriple | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return trianglePatternImpl(arg1, arg2 as AnchorTriple, arg3 ?? {});
}
