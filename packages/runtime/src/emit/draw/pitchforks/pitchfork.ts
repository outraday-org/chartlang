// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (PitchforkDrawing + PitchforkVariant), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Behaviour from
//   invinite/src/components/trading-chart/tools/pitchfork-tool.ts +
//   invinite/src/components/trading-chart/tools/schiff-pitchfork-tool.ts +
//   invinite/src/components/trading-chart/tools/modified-schiff-pitchfork-tool.ts +
//   invinite/src/components/trading-chart/tools/inside-pitchfork-tool.ts
//   (4 tools collapsed into one kind).
// Re-licensed MIT for chartlang.

import type {
    AnchorTriple,
    DrawingHandle,
    LineDrawStyle,
    PitchforkState,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.pitchfork called outside an active script step";

type PitchforkVariant = PitchforkState["variant"];

type PitchforkOpts = LineDrawStyle & { readonly variant?: PitchforkVariant };

function pitchforkImpl(slotId: string, anchors: AnchorTriple, opts: PitchforkOpts): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const { variant: variantOpt, ...style } = opts;
    const state: PitchforkState = {
        kind: "pitchfork",
        anchors,
        variant: variantOpt ?? "standard",
        style,
    };
    return createDrawingHandle(slotId, subId, "pitchfork", state);
}

/**
 * Draw an Andrews pitchfork from three world anchors `[a, b, c]`. The
 * `variant` opt selects one of four median-origin formulas:
 * `"standard"` (median from `a` to `mid(b, c)`); `"schiff"` (median
 * origin at `(a.time, mid(a.price, mid(b, c).price))`);
 * `"modifiedSchiff"` (median origin at `mid(a, b)`); `"inside"`
 * (median origin at `mid(b, c)` with the `(a → mid(a, b))` direction).
 * Default variant: `"standard"`. Mirrors invinite's four pitchfork
 * tools collapsed into one kind.
 *
 * @anchors `anchors` — `[pivot, high, low]` triple
 * @anchorCount 3
 * @bucket polylines
 * @since 0.3
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.pitchfork demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.pitchfork(
 *                 [
 *                     { time: bar.time, price: bar.low },
 *                     { time: bar.time + 30_000, price: bar.high },
 *                     { time: bar.time + 60_000, price: bar.close },
 *                 ],
 *                 { variant: "modifiedSchiff" },
 *             );
 *         },
 *     });
 */
export function pitchfork(anchors: AnchorTriple, opts?: PitchforkOpts): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof pitchfork = pitchfork;
 *     // void fn;
 */
export function pitchfork(
    slotId: string,
    anchors: AnchorTriple,
    opts?: PitchforkOpts,
): DrawingHandle;
/**
 * Implementation signature for {@link pitchfork}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const fn: typeof pitchfork = pitchfork;
 *     // void fn;
 */
export function pitchfork(
    arg1: string | AnchorTriple,
    arg2?: AnchorTriple | PitchforkOpts,
    arg3?: PitchforkOpts,
): DrawingHandle {
    if (typeof arg1 !== "string" || arg2 === undefined || !Array.isArray(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return pitchforkImpl(arg1, arg2 as AnchorTriple, arg3 ?? {});
}
