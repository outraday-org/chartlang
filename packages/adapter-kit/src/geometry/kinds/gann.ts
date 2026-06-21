// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Gann geometry moved from the canvas2d adapter's per-kind renderers
//   examples/canvas2d-adapter/src/render/draw/{gannBox,gannSquareFixed,
//   gannSquare,gannFan}.ts.
// The originating math is invinite's gann-box / gann-square /
// gann-fan tools (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02,
// © Invinite); re-licensed MIT for chartlang.

import type {
    GannBoxState,
    GannFanState,
    GannSquareFixedState,
    GannSquareState,
} from "@invinite-org/chartlang-core";

import { SOLID_DASH } from "../_lib/dash.js";
import { GANN_FAN_RATIOS, GANN_LEVELS } from "../_lib/gannLevels.js";
import { worldPointToPixel } from "../project.js";
import type { DrawPrimitive, Viewport } from "../types.js";

const DEFAULT_COLOR = "#a855f7";
const DEFAULT_LINE_WIDTH = 1;
const SIDE_PX = 80;

/**
 * Shared subdivision-grid builder for the three Gann box kinds — one
 * horizontal + one vertical polyline at every {@link GANN_LEVELS} ratio
 * across the `[left, right] × [top, bottom]` rectangle.
 */
function gridPolylines(
    left: number,
    right: number,
    top: number,
    bottom: number,
    color: string,
    width: number,
): DrawPrimitive[] {
    const stroke = { color, width, dash: SOLID_DASH };
    const out: DrawPrimitive[] = [];
    for (const level of GANN_LEVELS) {
        const y = top + level * (bottom - top);
        out.push({
            kind: "polyline",
            points: [
                { x: left, y },
                { x: right, y },
            ],
            closed: false,
            stroke,
        });
    }
    for (const level of GANN_LEVELS) {
        const x = left + level * (right - left);
        out.push({
            kind: "polyline",
            points: [
                { x, y: top },
                { x, y: bottom },
            ],
            closed: false,
            stroke,
        });
    }
    return out;
}

/**
 * Decompose a `gann-box` drawing — a ratio grid spanning the bounding
 * rectangle of the two world anchors, one horizontal + one vertical
 * line at each {@link GANN_LEVELS} entry (5 + 5 = 10 polylines for the
 * default 1/4 subdivisions, including the outer rectangle at 0 and 1.0).
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: GannBoxState;
 *     declare const v: Viewport;
 *     const prims = decomposeGannBox(s, v);
 *     void prims;
 */
export function decomposeGannBox(
    state: GannBoxState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const a = worldPointToPixel(state.anchors[0], view);
    const b = worldPointToPixel(state.anchors[1], view);
    return gridPolylines(
        Math.min(a.x, b.x),
        Math.max(a.x, b.x),
        Math.min(a.y, b.y),
        Math.max(a.y, b.y),
        state.style.color ?? DEFAULT_COLOR,
        state.style.lineWidth ?? DEFAULT_LINE_WIDTH,
    );
}

/**
 * Decompose a `gann-square-fixed` drawing — an `80×80` pixel square
 * anchored at `anchor`, subdivided by {@link GANN_LEVELS}. The fixed
 * pixel side mirrors the canvas2d source's deterministic constant.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: GannSquareFixedState;
 *     declare const v: Viewport;
 *     const prims = decomposeGannSquareFixed(s, v);
 *     void prims;
 */
export function decomposeGannSquareFixed(
    state: GannSquareFixedState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const origin = worldPointToPixel(state.anchor, view);
    return gridPolylines(
        origin.x,
        origin.x + SIDE_PX,
        origin.y,
        origin.y + SIDE_PX,
        state.style.color ?? DEFAULT_COLOR,
        state.style.lineWidth ?? DEFAULT_LINE_WIDTH,
    );
}

/**
 * Decompose a `gann-square` drawing — a square anchored at `anchors[0]`
 * with side `max(|dx|, |dy|)` in pixel space (the Gann-1×1 default),
 * extended in the direction of `anchors[1]`. Subdivisions follow
 * {@link GANN_LEVELS}.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: GannSquareState;
 *     declare const v: Viewport;
 *     const prims = decomposeGannSquare(s, v);
 *     void prims;
 */
export function decomposeGannSquare(
    state: GannSquareState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const a = worldPointToPixel(state.anchors[0], view);
    const b = worldPointToPixel(state.anchors[1], view);
    const side = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    const signX = b.x >= a.x ? 1 : -1;
    const signY = b.y >= a.y ? 1 : -1;
    const left = signX === 1 ? a.x : a.x - side;
    const right = signX === 1 ? a.x + side : a.x;
    const top = signY === 1 ? a.y : a.y - side;
    const bottom = signY === 1 ? a.y + side : a.y;
    return gridPolylines(
        left,
        right,
        top,
        bottom,
        state.style.color ?? DEFAULT_COLOR,
        state.style.lineWidth ?? DEFAULT_LINE_WIDTH,
    );
}

/**
 * Decompose a `gann-fan` drawing — 9 rays from `anchors[0]`, each with
 * direction `(dx, ratio · dy)` where `(dx, dy)` is the `anchors[0] →
 * anchors[1]` vector and `ratio` cycles through {@link GANN_FAN_RATIOS}.
 * Rays extend to `max(pxWidth, pxHeight) · 2` so they exit the viewport;
 * a zero-magnitude ray is skipped (matching the source `continue`).
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: GannFanState;
 *     declare const v: Viewport;
 *     const prims = decomposeGannFan(s, v);
 *     void prims;
 */
export function decomposeGannFan(
    state: GannFanState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const pivot = worldPointToPixel(state.anchors[0], view);
    const ref = worldPointToPixel(state.anchors[1], view);
    const dx = ref.x - pivot.x;
    const dy = ref.y - pivot.y;
    const color = state.style.color ?? DEFAULT_COLOR;
    const width = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    const rayLength = Math.max(view.pxWidth, view.pxHeight) * 2;
    const out: DrawPrimitive[] = [];
    for (const ratio of GANN_FAN_RATIOS) {
        const rx = dx;
        const ry = ratio * dy;
        const mag = Math.hypot(rx, ry);
        if (mag === 0) continue;
        const ux = rx / mag;
        const uy = ry / mag;
        out.push({
            kind: "polyline",
            points: [pivot, { x: pivot.x + ux * rayLength, y: pivot.y + uy * rayLength }],
            closed: false,
            stroke: { color, width, dash: SOLID_DASH },
        });
    }
    return out;
}
