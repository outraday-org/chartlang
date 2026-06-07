// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (ElliottDoubleComboDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/elliott-double-combo-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    AnchorHept,
    DrawingHandle,
    ElliottDoubleComboState,
    LineDrawStyle,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.elliottDoubleCombo called outside an active script step";

type DoubleComboOpts = LineDrawStyle & { labels?: ReadonlyArray<string> };

function elliottDoubleComboImpl(
    slotId: string,
    anchors: AnchorHept,
    opts: DoubleComboOpts,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const { labels, ...style } = opts;
    const state: ElliottDoubleComboState =
        labels === undefined
            ? { kind: "elliott-double-combo", anchors, style }
            : { kind: "elliott-double-combo", anchors, labels, style };
    return createDrawingHandle(slotId, subId, "elliott-double-combo", state);
}

/**
 * Draw an Elliott seven-anchor W-X-Y double-three corrective pattern
 * through 7 world anchors `[start, W-end, x1, X-end, x2, Y-mid,
 * Y-end]`. The renderer strokes the 6-leg connecting polyline and
 * labels each pivot. Pass `opts.labels` to override the default
 * `["S", "W", "x1", "X", "x2", "Yi", "Y"]` labels.
 *
 * @anchors `anchors` — `[start, W-end, x1, X-end, x2, Y-mid, Y-end]`
 * @anchorCount 7
 * @bucket polylines
 * @since 0.3
 * @experimental
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.elliottDoubleCombo demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.elliottDoubleCombo([
 *                 { time: bar.time, price: bar.low },
 *                 { time: bar.time + 10_000, price: bar.high },
 *                 { time: bar.time + 20_000, price: bar.close },
 *                 { time: bar.time + 30_000, price: bar.high + 1 },
 *                 { time: bar.time + 40_000, price: bar.close - 0.5 },
 *                 { time: bar.time + 50_000, price: bar.high + 2 },
 *                 { time: bar.time + 60_000, price: bar.close + 1 },
 *             ]);
 *         },
 *     });
 */
export function elliottDoubleCombo(
    anchors: AnchorHept,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof elliottDoubleCombo = elliottDoubleCombo;
 *     // void fn;
 */
export function elliottDoubleCombo(
    slotId: string,
    anchors: AnchorHept,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link elliottDoubleCombo}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const fn: typeof elliottDoubleCombo = elliottDoubleCombo;
 *     // void fn;
 */
export function elliottDoubleCombo(
    arg1: string | AnchorHept,
    arg2?: AnchorHept | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return elliottDoubleComboImpl(arg1, arg2 as AnchorHept, (arg3 ?? {}) as DoubleComboOpts);
}
