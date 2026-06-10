// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (ElliottTriangleWaveDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/elliott-triangle-wave-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    AnchorQuint,
    DrawingHandle,
    ElliottTriangleWaveState,
    LineDrawStyle,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.elliottTriangleWave called outside an active script step";

type TriangleOpts = LineDrawStyle & { labels?: ReadonlyArray<string> };

function elliottTriangleWaveImpl(
    slotId: string,
    anchors: AnchorQuint,
    opts: TriangleOpts,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const { labels, ...style } = opts;
    const state: ElliottTriangleWaveState =
        labels === undefined
            ? { kind: "elliott-triangle-wave", anchors, style }
            : { kind: "elliott-triangle-wave", anchors, labels, style };
    return createDrawingHandle(slotId, subId, "elliott-triangle-wave", state);
}

/**
 * Draw an Elliott five-wave triangle correction through 5 world anchors
 * `[a, b, c, d, e]`. The renderer strokes the connecting legs (a-b,
 * b-c, c-d, d-e) and labels each pivot. Pass `opts.labels` to override
 * the default `["a", "b", "c", "d", "e"]` labels.
 *
 * @anchors `anchors` — `[a, b, c, d, e]`
 * @anchorCount 5
 * @bucket polylines
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.elliottTriangleWave demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.elliottTriangleWave([
 *                 { time: bar.time, price: bar.high },
 *                 { time: bar.time + 15_000, price: bar.low },
 *                 { time: bar.time + 30_000, price: bar.high - 1 },
 *                 { time: bar.time + 45_000, price: bar.low + 1 },
 *                 { time: bar.time + 60_000, price: bar.close },
 *             ]);
 *         },
 *     });
 */
export function elliottTriangleWave(anchors: AnchorQuint, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof elliottTriangleWave = elliottTriangleWave;
 *     // void fn;
 */
export function elliottTriangleWave(
    slotId: string,
    anchors: AnchorQuint,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link elliottTriangleWave}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof elliottTriangleWave = elliottTriangleWave;
 *     // void fn;
 */
export function elliottTriangleWave(
    arg1: string | AnchorQuint,
    arg2?: AnchorQuint | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return elliottTriangleWaveImpl(arg1, arg2 as AnchorQuint, (arg3 ?? {}) as TriangleOpts);
}
