// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (HorizontalLineDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/horizontal-line-tool.ts.
// Re-licensed MIT for chartlang.

import type {
    DrawingHandle,
    HorizontalLineState,
    LineDrawStyle,
    Price,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.horizontalLine called outside an active script step";

function horizontalLineImpl(slotId: string, price: Price, opts: LineDrawStyle): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: HorizontalLineState = { kind: "horizontal-line", price, style: opts };
    return createDrawingHandle(slotId, subId, "horizontal-line", state);
}

/**
 * Draw a horizontal line at the supplied `price` that spans the full
 * viewport width. The handle is stable across bars.
 *
 * @anchors `price` — a single `Price`
 * @anchorCount 1
 * @bucket lines
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.horizontalLine demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.horizontalLine(bar.close, { color: "#ef4444", lineStyle: "dashed" });
 *         },
 *     });
 */
export function horizontalLine(price: Price, opts?: LineDrawStyle): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof horizontalLine = horizontalLine;
 *     // void fn;
 */
export function horizontalLine(slotId: string, price: Price, opts?: LineDrawStyle): DrawingHandle;
/**
 * Implementation signature for {@link horizontalLine}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof horizontalLine = horizontalLine;
 *     // void fn;
 */
export function horizontalLine(
    arg1: string | Price,
    arg2?: Price | LineDrawStyle,
    arg3?: LineDrawStyle,
): DrawingHandle {
    if (typeof arg1 !== "string" || typeof arg2 !== "number") {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return horizontalLineImpl(arg1, arg2, arg3 ?? {});
}
