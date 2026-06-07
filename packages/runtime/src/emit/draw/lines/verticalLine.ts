// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (VerticalLineDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/vertical-line-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    DrawingHandle,
    LineDrawStyle,
    Time,
    VerticalLineState,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.verticalLine called outside an active script step";

function verticalLineImpl(slotId: string, time: Time, opts: LineDrawStyle): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: VerticalLineState = { kind: "vertical-line", time, style: opts };
    return createDrawingHandle(slotId, subId, "vertical-line", state);
}

/**
 * Draw a vertical line at the supplied `time` that spans the full
 * viewport height.
 *
 * @anchors `time` — a single `Time`
 * @anchorCount 1
 * @bucket lines
 * @since 0.3
 * @experimental
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.verticalLine demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.verticalLine(bar.time, { color: "#f97316" });
 *         },
 *     });
 */
export function verticalLine(time: Time, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof verticalLine = verticalLine;
 *     // void fn;
 */
export function verticalLine(
    slotId: string,
    time: Time,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link verticalLine}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const fn: typeof verticalLine = verticalLine;
 *     // void fn;
 */
export function verticalLine(
    arg1: string | Time,
    arg2?: Time | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || typeof arg2 !== "number") {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return verticalLineImpl(arg1, arg2, arg3 ?? {});
}
