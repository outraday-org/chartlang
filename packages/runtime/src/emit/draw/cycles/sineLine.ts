// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (SineLineDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/sine-line-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    DrawingHandle,
    LineDrawStyle,
    SineLineState,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.sineLine called outside an active script step";

function sineLineImpl(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts: LineDrawStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: SineLineState = {
        kind: "sine-line",
        anchors: [a, b],
        style: opts,
    };
    return createDrawingHandle(slotId, subId, "sine-line", state);
}

/**
 * Draw a sinusoidal projection fitted between two world anchors. The
 * baseline is the midpoint price of the two anchors; the amplitude is
 * half the price span; the half-period spans `|to.time - from.time|`
 * (so the full period is twice that). The renderer samples 32 points
 * per full period and extends the wave across the visible viewport.
 *
 * @anchors `a`, `b` — two `WorldPoint`s `(from, to)`
 * @anchorCount 2
 * @bucket other
 * @since 0.3
 * @experimental
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.sineLine demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.sineLine(
 *                 { time: bar.time, price: bar.low },
 *                 { time: bar.time + 60_000, price: bar.high },
 *                 { color: "#0ea5e9" },
 *             );
 *         },
 *     });
 */
export function sineLine(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof sineLine = sineLine;
 *     // void fn;
 */
export function sineLine(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link sineLine}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const fn: typeof sineLine = sineLine;
 *     // void fn;
 */
export function sineLine(
    arg1: string | WorldPoint,
    arg2?: WorldPoint,
    arg3?: WorldPoint | LineDrawStyle,
    arg4?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || arg3 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return sineLineImpl(arg1, arg2, arg3 as WorldPoint, arg4 ?? {});
}
