// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (ArcDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/arc-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    AnchorTriple,
    ArcState,
    DrawingHandle,
    LineDrawStyle,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.arc called outside an active script step";

function arcImpl(slotId: string, anchors: AnchorTriple, opts: LineDrawStyle): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: ArcState = { kind: "arc", anchors, style: opts };
    return createDrawingHandle(slotId, subId, "arc", state);
}

/**
 * Draw an arc through three world anchors `[from, apex, to]`. The
 * renderer derives a quadratic Bezier control point from the apex via
 * inverse-quadratic interpolation so the curve passes through `apex`
 * at parameter `t = 0.5` — distinct from {@link curve} whose middle
 * anchor IS the control point (and the curve does NOT pass through
 * it). Mirrors invinite's `arc-tool.ts` shape.
 *
 * @anchors `anchors` — `[from, apex, to]` triple
 * @anchorCount 3
 * @bucket polylines
 * @since 0.3
 * @experimental
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.arc demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.arc(
 *                 [
 *                     { time: bar.time, price: bar.low },
 *                     { time: bar.time, price: bar.high },
 *                     { time: bar.time, price: bar.close },
 *                 ],
 *                 { color: "#3b82f6", lineWidth: 2 },
 *             );
 *         },
 *     });
 */
export function arc(anchors: AnchorTriple, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof arc = arc;
 *     // void fn;
 */
export function arc(slotId: string, anchors: AnchorTriple, opts?: LineDrawStyle): DrawingHandle;
/**
 * Implementation signature for {@link arc}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const fn: typeof arc = arc;
 *     // void fn;
 */
export function arc(
    arg1: string | AnchorTriple,
    arg2?: AnchorTriple | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return arcImpl(arg1, arg2 as AnchorTriple, arg3 ?? {});
}
