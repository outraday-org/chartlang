// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingHandle, TableOpts, TableState } from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.table called outside an active script step";

function tableImpl(slotId: string, opts: TableOpts): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: TableState = {
        kind: "table",
        position: opts.position,
        cells: opts.cells,
        ...(opts.borderColor === undefined ? {} : { borderColor: opts.borderColor }),
        ...(opts.borderWidth === undefined ? {} : { borderWidth: opts.borderWidth }),
        ...(opts.frame === undefined ? {} : { frame: opts.frame }),
    };
    return createDrawingHandle(slotId, subId, "table", state);
}

/**
 * Draw a CSS-pixel viewport-anchored table. Unlike world-space
 * drawings, `draw.table` carries no `WorldPoint` anchor; adapters
 * resolve `position` against the visible viewport per PLAN.md §10.2.
 *
 * @anchors `position` — CSS viewport anchor; `cells` — 2D grid payload
 * @anchorCount 0 (viewport anchored)
 * @bucket other
 * @since 0.5
 * @experimental
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.table demo",
 *         apiVersion: 1,
 *         compute({ draw }) {
 *             draw.table({
 *                 position: "top-right",
 *                 cells: [[{ text: "P&L" }, { text: "+12.5%", textColor: "#16a34a" }]],
 *             });
 *         },
 *     });
 */
export function table(opts: TableOpts): DrawingHandle;
/**
 * Compiler-injected overload — the callsite-id transformer rewrites
 * every script-side `draw.table(opts)` into
 * `draw.table(slotId, opts)`.
 *
 * @since 0.5
 * @experimental
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof table = table;
 *     // void fn;
 */
export function table(slotId: string, opts: TableOpts): DrawingHandle;
/**
 * Implementation signature for {@link table}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.5
 * @experimental
 * @example
 *     // const fn: typeof table = table;
 *     // void fn;
 */
export function table(arg1: string | TableOpts, arg2?: TableOpts): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return tableImpl(arg1, arg2);
}
