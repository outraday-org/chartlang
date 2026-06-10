// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (ElliottCorrectionWaveDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/elliott-correction-wave-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    AnchorTriple,
    DrawingHandle,
    ElliottCorrectionWaveState,
    LineDrawStyle,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.elliottCorrectionWave called outside an active script step";

type CorrectionOpts = LineDrawStyle & { labels?: ReadonlyArray<string> };

function elliottCorrectionWaveImpl(
    slotId: string,
    anchors: AnchorTriple,
    opts: CorrectionOpts,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const { labels, ...style } = opts;
    const state: ElliottCorrectionWaveState =
        labels === undefined
            ? { kind: "elliott-correction-wave", anchors, style }
            : { kind: "elliott-correction-wave", anchors, labels, style };
    return createDrawingHandle(slotId, subId, "elliott-correction-wave", state);
}

/**
 * Draw an Elliott three-wave A-B-C correction through 3 world anchors
 * `[A, B, C]`. The renderer strokes the connecting legs (A-B, B-C) and
 * labels each pivot. Pass `opts.labels` to override the default
 * `["A", "B", "C"]` labels.
 *
 * @anchors `anchors` — `[A, B, C]`
 * @anchorCount 3
 * @bucket polylines
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.elliottCorrectionWave demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.elliottCorrectionWave([
 *                 { time: bar.time, price: bar.high },
 *                 { time: bar.time + 30_000, price: bar.low },
 *                 { time: bar.time + 60_000, price: bar.close },
 *             ]);
 *         },
 *     });
 */
export function elliottCorrectionWave(anchors: AnchorTriple, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof elliottCorrectionWave = elliottCorrectionWave;
 *     // void fn;
 */
export function elliottCorrectionWave(
    slotId: string,
    anchors: AnchorTriple,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link elliottCorrectionWave}. Branches
 * on `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof elliottCorrectionWave = elliottCorrectionWave;
 *     // void fn;
 */
export function elliottCorrectionWave(
    arg1: string | AnchorTriple,
    arg2?: AnchorTriple | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return elliottCorrectionWaveImpl(arg1, arg2 as AnchorTriple, (arg3 ?? {}) as CorrectionOpts);
}
