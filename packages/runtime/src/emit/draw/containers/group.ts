// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// State shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (GroupDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// No standalone tool source exists in invinite — groups are
// metadata-only containers; their parent / child linkage is collab
// state stripped per PLAN.md §10.4.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingHandle, GroupState } from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.group called outside an active script step";

function groupImpl(
    slotId: string,
    childHandleIds: ReadonlyArray<string>,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: GroupState = {
        kind: "group",
        childHandleIds,
    };
    return createDrawingHandle(slotId, subId, "group", state);
}

/**
 * Group a set of previously emitted drawing handles under a single
 * logical container. The script-author passes the handle ids
 * collected from earlier `draw.<kind>(...).id` calls; the runtime
 * carries the list on the wire as a `GroupState`, and the adapter
 * renders nothing of its own — children render themselves per
 * PLAN.md §10.4.
 *
 * @anchors `childHandleIds` — a `ReadonlyArray<string>` of handle ids
 * @anchorCount 0 (metadata-only container)
 * @bucket other
 * @since 0.3
 * @experimental
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.group demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             const a = draw.line(
 *                 { time: bar.time, price: bar.low },
 *                 { time: bar.time + 60_000, price: bar.high },
 *             );
 *             const b = draw.line(
 *                 { time: bar.time, price: bar.high },
 *                 { time: bar.time + 60_000, price: bar.low },
 *             );
 *             draw.group([a.id, b.id]);
 *         },
 *     });
 */
export function group(childHandleIds: ReadonlyArray<string>): DrawingHandle;
/**
 * Compiler-injected overload — the callsite-id transformer rewrites
 * every script-side `draw.group(childHandleIds)` into
 * `draw.group(slotId, childHandleIds)`.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof group = group;
 *     // void fn;
 */
export function group(
    slotId: string,
    childHandleIds: ReadonlyArray<string>,
): DrawingHandle;
/**
 * Implementation signature for {@link group}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const fn: typeof group = group;
 *     // void fn;
 */
export function group(
    arg1: string | ReadonlyArray<string>,
    arg2?: ReadonlyArray<string>,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return groupImpl(arg1, arg2);
}
