// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (ElliottTripleComboDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/elliott-triple-combo-tool.ts.
// Note: invinite's full schema carries 10 anchors; the landed Task-1
// `ElliottTripleComboState.anchors: AnchorHept` is a 7-anchor shell
// — the additional 3 invinite pivots are flagged as a Task-1 reshape
// follow-up.
// Re-licensed MIT for chartlang.

import type {
    AnchorHept,
    DrawingHandle,
    ElliottTripleComboState,
    LineDrawStyle,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.elliottTripleCombo called outside an active script step";

type TripleComboOpts = LineDrawStyle & { labels?: ReadonlyArray<string> };

function elliottTripleComboImpl(
    slotId: string,
    anchors: AnchorHept,
    opts: TripleComboOpts,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const { labels, ...style } = opts;
    const state: ElliottTripleComboState =
        labels === undefined
            ? { kind: "elliott-triple-combo", anchors, style }
            : { kind: "elliott-triple-combo", anchors, labels, style };
    return createDrawingHandle(slotId, subId, "elliott-triple-combo", state);
}

/**
 * Draw an Elliott seven-anchor W-X-Y-X-Z triple-three corrective
 * pattern through 7 world anchors `[start, W-end, X1-end, Y-end,
 * X2-end, Z-mid, Z-end]`. The renderer strokes the 6-leg connecting
 * polyline and labels each pivot. Pass `opts.labels` to override the
 * default `["S", "W", "X1", "Y", "X2", "Zi", "Z"]` labels.
 *
 * @anchors `anchors` — `[start, W-end, X1-end, Y-end, X2-end, Z-mid, Z-end]`
 * @anchorCount 7
 * @bucket polylines
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.elliottTripleCombo demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.elliottTripleCombo([
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
export function elliottTripleCombo(anchors: AnchorHept, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof elliottTripleCombo = elliottTripleCombo;
 *     // void fn;
 */
export function elliottTripleCombo(
    slotId: string,
    anchors: AnchorHept,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link elliottTripleCombo}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof elliottTripleCombo = elliottTripleCombo;
 *     // void fn;
 */
export function elliottTripleCombo(
    arg1: string | AnchorHept,
    arg2?: AnchorHept | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return elliottTripleComboImpl(arg1, arg2 as AnchorHept, (arg3 ?? {}) as TripleComboOpts);
}
