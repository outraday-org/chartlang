// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (RegressionTrendDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/regression-trend-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    DrawingHandle,
    RegressionTrendOpts,
    RegressionTrendState,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.regressionTrend called outside an active script step";

function regressionTrendImpl(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts: RegressionTrendOpts,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: RegressionTrendState = {
        kind: "regression-trend",
        anchors: [a, b],
        style: opts,
    };
    return createDrawingHandle(slotId, subId, "regression-trend", state);
}

/**
 * Draw an OLS regression-trend line between two world anchors with
 * optional ±σ bands. The Phase-3 runtime emits the anchor pair + opts;
 * the actual OLS fit is computed by the adapter — consumer adapters
 * can use {@link import("@invinite-org/chartlang-runtime").linearRegression}
 * (re-exported by Task 10) without duplicating math. The reference
 * canvas2d adapter renders a placeholder anchor-to-anchor line because
 * `Viewport` does not expose a bar accessor — see
 * `tasks/phase-3-drawing-parity/10-channels.plan.md` §3. Mirrors
 * invinite's `regression-trend-tool.ts` shape.
 *
 * @anchors `a`, `b` — start and end `WorldPoint`s (a.time < b.time)
 * @anchorCount 2
 * @bucket polylines
 * @since 0.3
 * @experimental
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.regressionTrend demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.regressionTrend(
 *                 { time: bar.time, price: bar.close },
 *                 { time: bar.time + 30_000, price: bar.close },
 *                 {
 *                     source: "close",
 *                     stdevMultiplier: 2,
 *                     showUpperBand: true,
 *                     showLowerBand: true,
 *                 },
 *             );
 *         },
 *     });
 */
export function regressionTrend(
    a: WorldPoint,
    b: WorldPoint,
    opts?: RegressionTrendOpts,
): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof regressionTrend = regressionTrend;
 *     // void fn;
 */
export function regressionTrend(
    slotId: string,
    a: WorldPoint,
    b: WorldPoint,
    opts?: RegressionTrendOpts,
): DrawingHandle;
/**
 * Implementation signature for {@link regressionTrend}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const fn: typeof regressionTrend = regressionTrend;
 *     // void fn;
 */
export function regressionTrend(
    arg1: string | WorldPoint,
    arg2?: WorldPoint,
    arg3?: WorldPoint | RegressionTrendOpts,
    arg4?: RegressionTrendOpts,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || arg3 === undefined) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return regressionTrendImpl(arg1, arg2, arg3 as WorldPoint, arg4 ?? {});
}
