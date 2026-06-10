// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (CyclicLinesDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/cyclic-lines-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    CyclicLinesState,
    DrawingHandle,
    LineDrawStyle,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.cyclicLines called outside an active script step";

function cyclicLinesImpl(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts: LineDrawStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: CyclicLinesState = {
        kind: "cyclic-lines",
        anchors: [a, b],
        style: opts,
    };
    return createDrawingHandle(slotId, subId, "cyclic-lines", state);
}

/**
 * Draw equally spaced vertical lines marking cycle periods between two
 * world anchors `[from, to]`. The cycle period equals `|to.time -
 * from.time|`; the renderer projects repeated vertical strokes at every
 * `from.time + n*period` to the right until the viewport edge.
 *
 * @anchors `a`, `b` — two `WorldPoint`s `(from, to)`
 * @anchorCount 2
 * @bucket other
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.cyclicLines demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.cyclicLines(
 *                 { time: bar.time, price: bar.close },
 *                 { time: bar.time + 60_000, price: bar.close },
 *                 { color: "#0ea5e9" },
 *             );
 *         },
 *     });
 */
export function cyclicLines(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload — the callsite-id transformer rewrites
 * every script-side `draw.cyclicLines(a, b, opts)` into
 * `draw.cyclicLines(slotId, a, b, opts)`.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof cyclicLines = cyclicLines;
 *     // void fn;
 */
export function cyclicLines(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link cyclicLines}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof cyclicLines = cyclicLines;
 *     // void fn;
 */
export function cyclicLines(
    arg1: string | WorldPoint,
    arg2?: WorldPoint,
    arg3?: WorldPoint | LineDrawStyle,
    arg4?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || arg3 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return cyclicLinesImpl(arg1, arg2, arg3 as WorldPoint, arg4 ?? {});
}
