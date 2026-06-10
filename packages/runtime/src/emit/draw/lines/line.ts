// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts (LineDrawing),
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/line-tool.ts (base),
//   invinite/src/components/trading-chart/tools/ray-tool.ts (extendRight),
//   invinite/src/components/trading-chart/tools/extended-line-tool.ts
//     (extendLeft + extendRight). Re-licensed MIT for chartlang. See
// PLAN.md §3.1 + §22.10. Per PLAN.md §3.1 the three invinite tools
// collapse into one `line` kind on the wire.

import type {
    DrawingHandle,
    LineDrawStyle,
    LineState,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.line called outside an active script step";

function lineImpl(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts: LineDrawStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: LineState = { kind: "line", anchors: [a, b], style: opts };
    return createDrawingHandle(slotId, subId, "line", state);
}

/**
 * Draw a straight line between two world anchors. The invinite `ray`
 * tool collapses into this kind via `style.extendRight: true`; the
 * `extended-line` tool collapses via `extendLeft: true` + `extendRight:
 * true` per PLAN.md §3.1. The handle is stable across bars per §10.3 —
 * subsequent in-bar `update(patch)` calls merge into the slot's state
 * and re-emit the full payload under `op: "update"`.
 *
 * @anchors `a`, `b` — two `WorldPoint`s
 * @anchorCount 2
 * @bucket lines
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.line demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.line(
 *                 { time: bar.time, price: bar.high },
 *                 { time: bar.time, price: bar.low },
 *                 { color: "#3b82f6" },
 *             );
 *         },
 *     });
 */
export function line(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload — Task 2's callsite-id transformer
 * rewrites every script-side `draw.line(a, b, opts)` into
 * `draw.line(slotId, a, b, opts)`.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof line = line;
 *     // void fn;
 */
export function line(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link line}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof line = line;
 *     // void fn;
 */
export function line(
    arg1: string | WorldPoint,
    arg2?: WorldPoint,
    arg3?: WorldPoint | LineDrawStyle,
    arg4?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || arg3 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return lineImpl(arg1, arg2, arg3 as WorldPoint, arg4 ?? {});
}
