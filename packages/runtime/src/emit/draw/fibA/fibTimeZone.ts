// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (FibTimeZoneDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/fib-time-zone-tool.ts.
// Re-licensed MIT for chartlang.

import type {
    DrawingHandle,
    FibOpts,
    FibTimeZoneState,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.fibTimeZone called outside an active script step";

function fibTimeZoneImpl(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts: FibOpts,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: FibTimeZoneState = {
        kind: "fib-time-zone",
        anchors: [a, b],
        style: opts,
    };
    return createDrawingHandle(slotId, subId, "fib-time-zone", state);
}

/**
 * Draw fib-spaced vertical time zones between two world anchors. Each
 * level in `opts.levels ?? FIB_LEVELS` paints a vertical line at
 * `t = a.time + level * (b.time - a.time)`. Mirrors invinite's
 * `fib-time-zone-tool.ts` shape (using the ratio array per the landed
 * core state).
 *
 * @anchors `a`, `b` — two `WorldPoint`s defining the time span
 * @anchorCount 2
 * @bucket other
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.fibTimeZone demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.fibTimeZone(
 *                 { time: bar.time, price: bar.close },
 *                 { time: bar.time + 100_000, price: bar.close },
 *                 { showLabels: true },
 *             );
 *         },
 *     });
 */
export function fibTimeZone(a: WorldPoint, b: WorldPoint, opts?: FibOpts): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof fibTimeZone = fibTimeZone;
 *     // void fn;
 */
export function fibTimeZone(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts?: FibOpts,
): DrawingHandle;
/**
 * Implementation signature for {@link fibTimeZone}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof fibTimeZone = fibTimeZone;
 *     // void fn;
 */
export function fibTimeZone(
    arg1: string | WorldPoint,
    arg2?: WorldPoint,
    arg3?: WorldPoint | FibOpts,
    arg4?: FibOpts,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || arg3 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return fibTimeZoneImpl(arg1, arg2, arg3 as WorldPoint, arg4 ?? {});
}
