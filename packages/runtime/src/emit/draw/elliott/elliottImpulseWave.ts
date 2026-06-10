// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (ElliottImpulseWaveDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/elliott-impulse-wave-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type {
    AnchorQuint,
    DrawingHandle,
    ElliottImpulseWaveState,
    LineDrawStyle,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext";
import { createDrawingHandle } from "../handle";
import { nextSubId } from "../subIdAllocator";

const OUTSIDE_CTX_MESSAGE = "draw.elliottImpulseWave called outside an active script step";

type ImpulseOpts = LineDrawStyle & { labels?: ReadonlyArray<string> };

function elliottImpulseWaveImpl(
    slotId: string,
    anchors: AnchorQuint,
    opts: ImpulseOpts,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const { labels, ...style } = opts;
    const state: ElliottImpulseWaveState =
        labels === undefined
            ? { kind: "elliott-impulse-wave", anchors, style }
            : { kind: "elliott-impulse-wave", anchors, labels, style };
    return createDrawingHandle(slotId, subId, "elliott-impulse-wave", state);
}

/**
 * Draw an Elliott five-wave impulse pattern through 5 world anchors
 * `[wave1End, wave2End, wave3End, wave4End, wave5End]`. The renderer
 * strokes the connecting legs (1-2, 2-3, 3-4, 4-5) and labels each
 * pivot. Pass `opts.labels` to override the default `["1", "2", "3",
 * "4", "5"]` labels.
 *
 * @anchors `anchors` — `[wave1End, wave2End, wave3End, wave4End, wave5End]`
 * @anchorCount 5
 * @bucket polylines
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.elliottImpulseWave demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.elliottImpulseWave([
 *                 { time: bar.time, price: bar.low },
 *                 { time: bar.time + 15_000, price: bar.high },
 *                 { time: bar.time + 30_000, price: bar.close },
 *                 { time: bar.time + 45_000, price: bar.high + 1 },
 *                 { time: bar.time + 60_000, price: bar.close + 0.5 },
 *             ]);
 *         },
 *     });
 */
export function elliottImpulseWave(anchors: AnchorQuint, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof elliottImpulseWave = elliottImpulseWave;
 *     // void fn;
 */
export function elliottImpulseWave(
    slotId: string,
    anchors: AnchorQuint,
    opts?: LineDrawStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link elliottImpulseWave}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof elliottImpulseWave = elliottImpulseWave;
 *     // void fn;
 */
export function elliottImpulseWave(
    arg1: string | AnchorQuint,
    arg2?: AnchorQuint | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return elliottImpulseWaveImpl(arg1, arg2 as AnchorQuint, (arg3 ?? {}) as ImpulseOpts);
}
