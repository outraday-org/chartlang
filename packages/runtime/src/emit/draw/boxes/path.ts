// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (PathDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/path-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingHandle, PathOpts, PathState, WorldPoint } from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.path called outside an active script step";

function pathImpl(
    slotId: string,
    anchors: ReadonlyArray<WorldPoint>,
    opts: PathOpts,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: PathState = { kind: "path", anchors, style: opts };
    return createDrawingHandle(slotId, subId, "path", state);
}

/**
 * Draw an OPEN polyline through N world anchors. Distinct from
 * `draw.polyline` (Task 6) which is CLOSED — `path` does NOT
 * auto-connect the last anchor back to the first. Use
 * `opts.closed === true` to override and close the path explicitly.
 * Supply 2..20 anchors (validator pins this range, mirroring
 * invinite's 20-point cap).
 *
 * @anchors `anchors` — `ReadonlyArray<WorldPoint>` of length 2..20
 * @anchorCount 2..20
 * @bucket polylines
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.path demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.path(
 *                 [
 *                     { time: bar.time, price: bar.open },
 *                     { time: bar.time, price: bar.close },
 *                 ],
 *                 { color: "#3b82f6", lineWidth: 2 },
 *             );
 *         },
 *     });
 */
export function path(anchors: ReadonlyArray<WorldPoint>, opts?: PathOpts): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof path = path;
 *     // void fn;
 */
export function path(
    slotId: string,
    anchors: ReadonlyArray<WorldPoint>,
    opts?: PathOpts,
): DrawingHandle;
/**
 * Implementation signature for {@link path}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof path = path;
 *     // void fn;
 */
export function path(
    arg1: string | ReadonlyArray<WorldPoint>,
    arg2?: ReadonlyArray<WorldPoint> | PathOpts,
    arg3?: PathOpts,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return pathImpl(arg1, arg2 as ReadonlyArray<WorldPoint>, arg3 ?? {});
}
