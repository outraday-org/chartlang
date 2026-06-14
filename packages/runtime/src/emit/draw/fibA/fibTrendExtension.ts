// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (FibTrendExtensionDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/fib-trend-extension-tool.ts.
// Re-licensed MIT for chartlang.

import type {
    AnchorTriple,
    DrawingHandle,
    FibOpts,
    FibTrendExtensionState,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.fibTrendExtension called outside an active script step";

function fibTrendExtensionImpl(
    slotId: string,
    anchors: AnchorTriple,
    opts: FibOpts,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: FibTrendExtensionState = {
        kind: "fib-trend-extension",
        anchors,
        style: opts,
    };
    return createDrawingHandle(slotId, subId, "fib-trend-extension", state);
}

/**
 * Draw a Fibonacci trend extension from three world anchors `[A, B,
 * C]`. The (A→B) leg defines the price delta; each level projects an
 * extension from `C.price` at `level * (B.price - A.price)`. Mirrors
 * invinite's `fib-trend-extension-tool.ts` shape.
 *
 * @anchors `anchors` — `[A, B, C]` triple (swing pivot, swing target, projection origin)
 * @anchorCount 3
 * @bucket other
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.fibTrendExtension demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.fibTrendExtension(
 *                 [
 *                     { time: bar.time, price: bar.low },
 *                     { time: bar.time, price: bar.high },
 *                     { time: bar.time, price: bar.close },
 *                 ],
 *                 { showLabels: true },
 *             );
 *         },
 *     });
 */
export function fibTrendExtension(anchors: AnchorTriple, opts?: FibOpts): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof fibTrendExtension = fibTrendExtension;
 *     // void fn;
 */
export function fibTrendExtension(
    slotId: string,
    anchors: AnchorTriple,
    opts?: FibOpts,
): DrawingHandle;
/**
 * Implementation signature for {@link fibTrendExtension}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof fibTrendExtension = fibTrendExtension;
 *     // void fn;
 */
export function fibTrendExtension(
    arg1: string | AnchorTriple,
    arg2?: AnchorTriple | FibOpts,
    arg3?: FibOpts,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return fibTrendExtensionImpl(arg1, arg2 as AnchorTriple, arg3 ?? {});
}
