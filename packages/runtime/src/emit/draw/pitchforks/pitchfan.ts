// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (PitchfanDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/pitchfan-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    AnchorTriple,
    DrawingHandle,
    LineDrawStyle,
    PitchfanState,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.pitchfan called outside an active script step";

function pitchfanImpl(
    slotId: string,
    anchors: AnchorTriple,
    opts: LineDrawStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: PitchfanState = { kind: "pitchfan", anchors, style: opts };
    return createDrawingHandle(slotId, subId, "pitchfan", state);
}

/**
 * Draw a pitchfan — three rays from `anchors[0]` through `anchors[1]`,
 * `midpoint(anchors[1], anchors[2])`, and `anchors[2]`. Unlike a
 * pitchfork the rays diverge from a single pivot rather than forming
 * parallel rails. Mirrors invinite's `pitchfan-tool.ts` shape.
 *
 * @anchors `anchors` — `[pivot, high, low]` triple
 * @anchorCount 3
 * @bucket polylines
 * @since 0.3
 * @experimental
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.pitchfan demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.pitchfan([
 *                 { time: bar.time, price: bar.low },
 *                 { time: bar.time + 30_000, price: bar.high },
 *                 { time: bar.time + 60_000, price: bar.close },
 *             ]);
 *         },
 *     });
 */
export function pitchfan(anchors: AnchorTriple, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof pitchfan = pitchfan;
 *     // void fn;
 */
export function pitchfan(
    slotId: string,
    anchors: AnchorTriple,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link pitchfan}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const fn: typeof pitchfan = pitchfan;
 *     // void fn;
 */
export function pitchfan(
    arg1: string | AnchorTriple,
    arg2?: AnchorTriple | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return pitchfanImpl(arg1, arg2 as AnchorTriple, arg3 ?? {});
}
