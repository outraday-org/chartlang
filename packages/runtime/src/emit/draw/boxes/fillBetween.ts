// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    DrawingHandle,
    FillBetweenState,
    FillBetweenStyle,
    WorldPoint,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT } from "../../../runtimeContext.js";
import { createDrawingHandle } from "../handle.js";
import { nextSubId } from "../subIdAllocator.js";

const OUTSIDE_CTX_MESSAGE = "draw.fillBetween called outside an active script step";

function fillBetweenImpl(
    slotId: string,
    edgeA: ReadonlyArray<WorldPoint>,
    edgeB: ReadonlyArray<WorldPoint>,
    opts: FillBetweenStyle,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);
    const subId = nextSubId(ctx, slotId);
    const state: FillBetweenState = { kind: "fill-between", edgeA, edgeB, style: opts };
    return createDrawingHandle(slotId, subId, "fill-between", state);
}

/**
 * Fill the ribbon between two edges. The native equivalent of Pine
 * `linefill.new(line1, line2, color)` and `fill(plot1, plot2, color)`.
 * The filled region is the closed polygon `edgeA` forward then `edgeB`
 * reversed; the two edges need not share x-coordinates or length.
 *
 * @anchors `edgeA`, `edgeB` — two `WorldPoint` lists (the band edges)
 * @anchorCount variable — each edge needs 2..10000 finite anchors
 * @bucket polylines
 * @warmup none — guard warmup in-script: an edge with fewer than 2 finite
 *   anchors (empty, single-point, or a `NaN` coordinate) is dropped with a
 *   `malformed-emission` diagnostic, so accumulate then gate on `length >= 2`
 *   as the example does.
 * @since 0.4
 * @stable
 * @example
 *     import { type WorldPoint, defineIndicator } from "@invinite-org/chartlang-core";
 *     const top: WorldPoint[] = [];
 *     const bottom: WorldPoint[] = [];
 *     export default defineIndicator({
 *         name: "draw.fillBetween demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             top.push({ time: bar.time, price: bar.high });
 *             bottom.push({ time: bar.time, price: bar.low });
 *             if (top.length >= 2) {
 *                 draw.fillBetween(top, bottom, { fill: "#3b82f6", fillAlpha: 0.2 });
 *             }
 *         },
 *     });
 */
export function fillBetween(
    edgeA: ReadonlyArray<WorldPoint>,
    edgeB: ReadonlyArray<WorldPoint>,
    opts?: FillBetweenStyle,
): DrawingHandle;
/**
 * Compiler-injected overload.
 *
 * @since 0.4
 * @stable
 * @example
 *     // Internal — the compiler rewrites every script callsite.
 *     // const fn: typeof fillBetween = fillBetween;
 *     // void fn;
 */
export function fillBetween(
    slotId: string,
    edgeA: ReadonlyArray<WorldPoint>,
    edgeB: ReadonlyArray<WorldPoint>,
    opts?: FillBetweenStyle,
): DrawingHandle;
/**
 * Implementation signature for {@link fillBetween}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.4
 * @stable
 * @example
 *     // const fn: typeof fillBetween = fillBetween;
 *     // void fn;
 */
export function fillBetween(
    arg1: string | ReadonlyArray<WorldPoint>,
    arg2?: ReadonlyArray<WorldPoint>,
    arg3?: ReadonlyArray<WorldPoint> | FillBetweenStyle,
    arg4?: FillBetweenStyle,
): DrawingHandle {
    if (
        typeof arg1 !== "string" ||
        arg2 === undefined ||
        !Array.isArray(arg2) ||
        arg3 === undefined ||
        !Array.isArray(arg3)
    ) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    return fillBetweenImpl(arg1, arg2, arg3 as ReadonlyArray<WorldPoint>, arg4 ?? {});
}
