// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (CurveDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/curve-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    AnchorTriple,
    CurveState,
    DrawingHandle,
    LineDrawStyle,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.curve called outside an active script step";

function curveImpl(slotId: string, anchors: AnchorTriple, opts: LineDrawStyle): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: CurveState = { kind: "curve", anchors, style: opts };
    return createDrawingHandle(slotId, subId, "curve", state);
}

/**
 * Draw a quadratic Bezier curve through three world anchors
 * `[from, control, to]`. The middle anchor IS the off-curve Bezier
 * control point — the rendered curve does NOT pass through it
 * (distinct from {@link arc} whose middle anchor is the apex the
 * curve passes through). Mirrors invinite's `curve-tool.ts` shape.
 *
 * @anchors `anchors` — `[from, control, to]` triple
 * @anchorCount 3
 * @bucket polylines
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.curve demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.curve(
 *                 [
 *                     { time: bar.time, price: bar.open },
 *                     { time: bar.time, price: bar.high },
 *                     { time: bar.time, price: bar.close },
 *                 ],
 *                 { color: "#22c55e", lineWidth: 1 },
 *             );
 *         },
 *     });
 */
export function curve(anchors: AnchorTriple, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof curve = curve;
 *     // void fn;
 */
export function curve(slotId: string, anchors: AnchorTriple, opts?: LineDrawStyle): DrawingHandle;
/**
 * Implementation signature for {@link curve}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof curve = curve;
 *     // void fn;
 */
export function curve(
    arg1: string | AnchorTriple,
    arg2?: AnchorTriple | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return curveImpl(arg1, arg2 as AnchorTriple, arg3 ?? {});
}
