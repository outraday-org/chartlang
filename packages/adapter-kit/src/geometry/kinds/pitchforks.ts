// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Pitchfork geometry moved from the canvas2d adapter's per-kind
// renderers
//   examples/canvas2d-adapter/src/render/draw/{pitchfork,pitchfan}.ts.
// The originating math is invinite's pitchfork / pitchfan tools (commit
// 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite); re-licensed
// MIT for chartlang.

import type { PitchfanState, PitchforkState } from "@invinite-org/chartlang-core";

import { SOLID_DASH } from "../_lib/dash.js";
import { medianOriginFor, medianTargetFor } from "../_lib/pitchforkGeom.js";
import { worldPointToPixel } from "../project.js";
import type { DrawPrimitive, Viewport } from "../types.js";

const DEFAULT_COLOR = "#ec4899";
const DEFAULT_LINE_WIDTH = 1;

/**
 * Decompose a `pitchfork` drawing — three line segments: a median rail
 * from the per-variant `medianOrigin` through `medianTarget`, extended
 * one fork vector (`target − origin`) past the target, plus two
 * parallel handle rails through `anchors[1]` / `anchors[2]` offset by
 * that same extension vector. The `variant` discriminator selects one
 * of the four median-origin formulas via {@link medianOriginFor}.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: PitchforkState;
 *     declare const v: Viewport;
 *     const prims = decomposePitchfork(s, v);
 *     // prims.length === 3
 *     void prims;
 */
export function decomposePitchfork(
    state: PitchforkState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const a = worldPointToPixel(state.anchors[0], view);
    const b = worldPointToPixel(state.anchors[1], view);
    const c = worldPointToPixel(state.anchors[2], view);
    const origin = medianOriginFor(state.variant, a, b, c);
    const target = medianTargetFor(state.variant, a, b, c);
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const stroke = {
        color: state.style.color ?? DEFAULT_COLOR,
        width: state.style.lineWidth ?? DEFAULT_LINE_WIDTH,
        dash: SOLID_DASH,
    };
    return [
        {
            kind: "polyline",
            points: [origin, { x: target.x + dx, y: target.y + dy }],
            closed: false,
            stroke,
        },
        {
            kind: "polyline",
            points: [b, { x: b.x + dx, y: b.y + dy }],
            closed: false,
            stroke,
        },
        {
            kind: "polyline",
            points: [c, { x: c.x + dx, y: c.y + dy }],
            closed: false,
            stroke,
        },
    ];
}

/**
 * Decompose a `pitchfan` drawing — three rays from `anchors[0]` passing
 * through `anchors[1]`, `mid(anchors[1], anchors[2])`, and `anchors[2]`.
 * Each ray extends to `max(pxWidth, pxHeight) · 2`; a zero-magnitude ray
 * is skipped (matching the source `continue`).
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: PitchfanState;
 *     declare const v: Viewport;
 *     const prims = decomposePitchfan(s, v);
 *     void prims;
 */
export function decomposePitchfan(
    state: PitchfanState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const a = worldPointToPixel(state.anchors[0], view);
    const b = worldPointToPixel(state.anchors[1], view);
    const c = worldPointToPixel(state.anchors[2], view);
    const midBC = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const stroke = {
        color: state.style.color ?? DEFAULT_COLOR,
        width: state.style.lineWidth ?? DEFAULT_LINE_WIDTH,
        dash: SOLID_DASH,
    };
    const rayLength = Math.max(view.pxWidth, view.pxHeight) * 2;
    const out: DrawPrimitive[] = [];
    for (const target of [b, midBC, c]) {
        const dx = target.x - a.x;
        const dy = target.y - a.y;
        const mag = Math.hypot(dx, dy);
        if (mag === 0) continue;
        const ux = dx / mag;
        const uy = dy / mag;
        out.push({
            kind: "polyline",
            points: [a, { x: a.x + ux * rayLength, y: a.y + uy * rayLength }],
            closed: false,
            stroke,
        });
    }
    return out;
}
