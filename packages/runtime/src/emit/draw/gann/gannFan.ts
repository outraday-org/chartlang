// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (GannFanDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/gann-fan-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    DrawingHandle,
    GannFanState,
    LineDrawStyle,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.gannFan called outside an active script step";

function gannFanImpl(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts: LineDrawStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: GannFanState = {
        kind: "gann-fan",
        anchors: [a, b],
        style: opts,
    };
    return createDrawingHandle(slotId, subId, "gann-fan", state);
}

/**
 * Draw a Gann fan — 9 rays emanating from `a` at the canonical Gann
 * angles (`1x1`, `1x2`, `1x3`, `2x1`, `3x1`, `1x4`, `4x1`, `1x8`,
 * `8x1`). The 1×1 ray points directly at `b`; the other 8 are slope
 * scalings of the (a→b) direction vector. Mirrors invinite's
 * `gann-fan-tool.ts` shape.
 *
 * @anchors `a`, `b` — two `WorldPoint`s (pivot, reference)
 * @anchorCount 2
 * @bucket other
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.gannFan demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.gannFan(
 *                 { time: bar.time, price: bar.low },
 *                 { time: bar.time + 30_000, price: bar.high },
 *             );
 *         },
 *     });
 */
export function gannFan(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof gannFan = gannFan;
 *     // void fn;
 */
export function gannFan(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link gannFan}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof gannFan = gannFan;
 *     // void fn;
 */
export function gannFan(
    arg1: string | WorldPoint,
    arg2?: WorldPoint,
    arg3?: WorldPoint | LineDrawStyle,
    arg4?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || arg3 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return gannFanImpl(arg1, arg2, arg3 as WorldPoint, arg4 ?? {});
}
